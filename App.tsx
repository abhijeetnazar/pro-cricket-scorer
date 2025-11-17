

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from './contexts/AppContext';
import { Card, Button, Modal, Input, Select } from './components/ui';
import { CricketBatIcon, CricketBallIcon, UsersIcon, UserPlusIcon, PlusIcon, LogoutIcon, CloudUploadIcon, RotateCcwIcon, Trash2Icon, MenuIcon, XIcon, SwapIcon, BarChartIcon, EditIcon, ChevronUpIcon, ChevronDownIcon, DatabaseIcon } from './components/icons';
// FIX: Import Team type to use it in the processDelivery function signature.
import type { Match, MatchSettings, Inning, Ball, Player, Team, BallEvent } from './types';
import { produce } from 'immer';
import { ThemeSelector } from './components/ThemeSelector';

declare const jspdf: any;
declare const html2canvas: any;

// Scoring Engine & Helper Logic

type ScoreEventType =
  | { type: 'RUN', runs: number }
  | { type: 'EXTRA', extraType: 'Wd' | 'Nb' | 'B' | 'Lb', runs: number, runsOffBat: boolean }
  | { type: 'WICKET', dismissalType: Ball['wicket']['type'], dismissedPlayerId: string, nextBatsmanId: string | null, runs: number, assistingPlayerId?: string, secondAssistingPlayerId?: string };

// FIX: Pass teams array to have access to team names for result text.
const processDelivery = (match: Match, event: ScoreEventType, teams: Team[]): Match => {
    return produce(match, draft => {
        const isFirstInning = !draft.inning2;
        const currentInning = (isFirstInning ? draft.inning1 : draft.inning2) as Inning;
        const isLastOver = currentInning.overs === draft.settings.overs - 1;
        
        // Defensive check to prevent state corruption if IDs are invalid
        if (!currentInning.batsmanStats[currentInning.onStrikeBatsmanId] || !currentInning.bowlerStats[currentInning.currentBowlerId]) {
            console.error("Critical Error: Batsman or Bowler stats missing for current players on field.");
            return; // Exit mutation if state is corrupt
        }

        let runs = 0;
        let extras = 0;
        let isLegalBall = true;
        let wicket: Ball['wicket'] | null = null;
        let ballEventType: BallEvent | null = null;
        
        const bowlerStats = currentInning.bowlerStats[currentInning.currentBowlerId];
        const onStrikeStats = currentInning.batsmanStats[currentInning.onStrikeBatsmanId];

        // 1. Process the event
        switch (event.type) {
            case 'RUN':
                runs = event.runs;
                onStrikeStats.runs += runs;
                if (runs === 4) onStrikeStats.fours++;
                if (runs === 6) onStrikeStats.sixes++;
                ballEventType = 'Run';
                break;
            
            case 'EXTRA':
                ballEventType = event.extraType === 'Wd' ? 'Wide'
                              : event.extraType === 'Nb' ? 'No Ball'
                              : event.extraType === 'B' ? 'Bye'
                              : 'Leg Bye';

                if (event.extraType === 'Wd' || event.extraType === 'Nb') {
                    const isWide = event.extraType === 'Wd';
                    
                    const isAttemptingLastLegalBall = currentInning.balls === 5;
                    
                    let rebowlThisBall = false;

                    if (isWide) {
                        // Default behavior
                        rebowlThisBall = draft.settings.rebowlWide ?? true;
                        // "All in last over" rule takes highest precedence
                        if (isLastOver && (draft.settings.rebowlWideAllInLastOver ?? false)) {
                            rebowlThisBall = true;
                        } 
                        // "Last ball only" is next, and is a restrictive override
                        else if (draft.settings.rebowlWideLastBallOfOver ?? false) {
                            rebowlThisBall = isAttemptingLastLegalBall;
                        }
                    } else { // No Ball
                        // Default behavior
                        rebowlThisBall = draft.settings.rebowlNoBall ?? true;
                        // "All in last over" rule takes highest precedence
                        if (isLastOver && (draft.settings.rebowlNoBallAllInLastOver ?? false)) {
                            rebowlThisBall = true;
                        } 
                        // "Last ball only" is next, and is a restrictive override
                        else if (draft.settings.rebowlNoBallLastBallOfOver ?? false) {
                            rebowlThisBall = isAttemptingLastLegalBall;
                        }
                    }

                    isLegalBall = !rebowlThisBall;

                    if (isWide) {
                        const wideBaseRuns = (isLastOver && draft.settings.rebowlWideAllInLastOver) ? 1 : (draft.settings.wideRuns ?? 2);
                        extras = wideBaseRuns + event.runs;
                    } else { // No Ball
                        const noBallBaseRuns = (isLastOver && draft.settings.rebowlNoBallAllInLastOver) ? 1 : (draft.settings.noBallRuns ?? 2);
                        extras = noBallBaseRuns;
                        if (event.runsOffBat) {
                            runs = event.runs;
                            onStrikeStats.runs += runs;
                            if (runs === 4) onStrikeStats.fours++;
                            if (runs === 6) onStrikeStats.sixes++;
                        } else {
                            extras += event.runs;
                        }
                    }
                } else { // Byes or Leg Byes
                    extras = event.runs;
                    isLegalBall = true;
                }
                break;

            case 'WICKET':
                runs = event.runs;
                if (runs > 0) {
                  onStrikeStats.runs += runs;
                  if (runs === 4) onStrikeStats.fours++;
                  if (runs === 6) onStrikeStats.sixes++;
                }

                currentInning.wickets++;
                wicket = {
                    playerId: event.dismissedPlayerId,
                    type: event.dismissalType,
                    assistingPlayerId: event.assistingPlayerId,
                    secondAssistingPlayerId: event.secondAssistingPlayerId,
                };
                currentInning.batsmanStats[event.dismissedPlayerId].isOut = true;
                currentInning.fallOfWickets.push({ score: currentInning.score + runs + extras, wicket: currentInning.wickets, over: currentInning.overs + currentInning.balls / 10, playerId: event.dismissedPlayerId });
                ballEventType = 'Wicket';
                
                if (['Bowled', 'Caught', 'LBW', 'Stumped'].includes(event.dismissalType)) {
                    bowlerStats.wickets++;
                }
                
                if (currentInning.wickets < draft.settings.playersPerTeam - 1 && event.nextBatsmanId) {
                    if (event.dismissedPlayerId === currentInning.onStrikeBatsmanId) {
                        currentInning.onStrikeBatsmanId = event.nextBatsmanId;
                    } else {
                        currentInning.nonStrikeBatsmanId = event.nextBatsmanId;
                    }
                    // When a retired batsman returns, clear their retirement status
                    const nextBatsmanStats = currentInning.batsmanStats[event.nextBatsmanId];
                    if (nextBatsmanStats?.retirementReason) {
                        nextBatsmanStats.retirementReason = undefined;
                    }
                }
                break;
        }

        // 2. Update scores and stats
        currentInning.score += runs + extras;
        bowlerStats.runsConceded += runs + extras;

        // 2a. Check for second innings win condition (chase complete)
        if (!isFirstInning) {
            const inning2 = draft.inning2!;
            const inning1Score = draft.inning1.score;
            if (inning2.score > inning1Score) {
                draft.status = 'Finished';
                draft.winnerTeamId = inning2.battingTeamId;
                const wicketsInHand = (draft.settings.playersPerTeam - 1) - inning2.wickets;
                draft.resultText = `${teams.find(t => t.id === draft.winnerTeamId)?.name} won by ${wicketsInHand} wickets.`;
                return; // Match is over, no further processing needed.
            }
        }
        
        // 3. Create timeline entry
        const ballEvent: Ball = {
            ballNumber: isLegalBall ? currentInning.balls + 1 : 0,
            overNumber: currentInning.overs,
            runs: runs,
            extras: extras,
            event: ballEventType,
            batsmanId: currentInning.onStrikeBatsmanId,
            bowlerId: currentInning.currentBowlerId,
            wicket: wicket || undefined
        };
        currentInning.timeline.push(ballEvent);
        
        if (isLegalBall) {
            onStrikeStats.balls++;
            currentInning.balls++;
            bowlerStats.balls++;
        }
        
        // 4. Handle strike rotation
        const endOfOver = isLegalBall && currentInning.balls === 6;
        if ((runs % 2 !== 0 && !endOfOver) || (runs % 2 === 0 && endOfOver)) {
            [currentInning.onStrikeBatsmanId, currentInning.nonStrikeBatsmanId] = [currentInning.nonStrikeBatsmanId, currentInning.onStrikeBatsmanId];
        }

        // 5. Handle end of over
        if (endOfOver) {
            const overJustCompleted = currentInning.overs;
            
            // Maiden Calculation
            const overTimeline = currentInning.timeline.filter(b => b.overNumber === overJustCompleted && b.bowlerId === currentInning.currentBowlerId);
            let runsPreventingMaiden = 0;
            overTimeline.forEach(ball => {
                if (ball.event === 'Wide' || ball.event === 'No Ball') {
                    runsPreventingMaiden += ball.extras;
                }
                runsPreventingMaiden += ball.runs;
            });
            if(runsPreventingMaiden === 0) {
                bowlerStats.maidens++;
            }

            currentInning.overs++;
            currentInning.balls = 0;
            bowlerStats.overs++;
            bowlerStats.balls = 0;

            const isAllOut = currentInning.wickets === draft.settings.playersPerTeam - 1;
            const isOversFinished = currentInning.overs === draft.settings.overs;

            if (!isAllOut && !isOversFinished) {
                if (isFirstInning) {
                    draft.inning1.awaitingNextBowler = true;
                } else if (draft.inning2) {
                    draft.inning2.awaitingNextBowler = true;
                }
            }
        }

        // 6. Check for end of innings (all out or overs completed)
        const allOut = currentInning.wickets === draft.settings.playersPerTeam - 1;
        const oversFinished = currentInning.overs === draft.settings.overs;

        if (allOut || oversFinished) {
            if (isFirstInning) {
                 const newBattingTeamId = draft.inning1.bowlingTeamId;
                 const newBowlingTeamId = draft.inning1.battingTeamId;
                 
                 const newBattingTeamPlayers = newBattingTeamId === draft.teamAId ? draft.teamAPlayers : draft.teamBPlayers;
                 const newBowlingTeamPlayers = newBowlingTeamId === draft.teamAId ? draft.teamAPlayers : draft.teamBPlayers;

                draft.inning2 = {
                    battingTeamId: newBattingTeamId,
                    bowlingTeamId: newBowlingTeamId,
                    score: 0, wickets: 0, overs: 0, balls: 0, timeline: [],
                    batsmanStats: Object.fromEntries(newBattingTeamPlayers.map(pId => [pId, { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false }])),
                    bowlerStats: Object.fromEntries(newBowlingTeamPlayers.map(pId => [pId, { overs: 0, balls: 0, runsConceded: 0, wickets: 0, maidens: 0 }])),
                    onStrikeBatsmanId: '',
                    nonStrikeBatsmanId: '',
                    currentBowlerId: '',
                    fallOfWickets: [],
                    awaitingNextBowler: true,
                };
                 draft.status = 'Upcoming';
            } else {
                draft.status = 'Finished';
                const score1 = draft.inning1.score;
                const score2 = draft.inning2!.score;
                if (score2 > score1) {
                    draft.winnerTeamId = draft.inning2!.battingTeamId;
                    const wicketsInHand = (draft.settings.playersPerTeam - 1) - draft.inning2!.wickets;
                    draft.resultText = `${teams.find(t=>t.id===draft.winnerTeamId)?.name} won by ${wicketsInHand} wickets.`;
                } else if (score1 > score2) {
                    draft.winnerTeamId = draft.inning1.battingTeamId;
                    draft.resultText = `${teams.find(t=>t.id===draft.winnerTeamId)?.name} won by ${score1 - score2} runs.`;
                } else {
                    draft.resultText = 'Match Tied.';
                }
            }
        }
    });
};


const ExtrasModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onRecord: (extraType: 'Wd' | 'Nb' | 'B' | 'Lb', runs: number, runsOffBat: boolean) => void;
}> = ({ isOpen, onClose, onRecord }) => {
    const [extraType, setExtraType] = useState<'Wd' | 'Nb' | 'B' | 'Lb'>('Wd');
    const [runs, setRuns] = useState(0);
    const [runsOffBat, setRunsOffBat] = useState(false);

    const handleSubmit = () => {
        onRecord(extraType, runs, runsOffBat);
        onClose();
        setRuns(0);
        setRunsOffBat(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Extras">
            <div className="space-y-4">
                <Select label="Extra Type" value={extraType} onChange={e => setExtraType(e.target.value as any)}>
                    <option value="Wd">Wide (Wd)</option>
                    <option value="Nb">No Ball (Nb)</option>
                    <option value="B">Bye (B)</option>
                    <option value="Lb">Leg Bye (Lb)</option>
                </Select>
                <Input label={`Additional Runs (e.g. overthrows)${extraType === 'Nb' ? ' or runs off bat' : ''}`} type="number" min="0" value={runs} onChange={e => setRuns(parseInt(e.target.value) || 0)} />
                {extraType === 'Nb' && (
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" id="runsOffBat" checked={runsOffBat} onChange={e => setRunsOffBat(e.target.checked)} />
                        <label htmlFor="runsOffBat">Runs scored off the bat?</label>
                    </div>
                )}
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSubmit}>Record</Button>
                </div>
            </div>
        </Modal>
    );
};

const WicketModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onRecord: (dismissalType: Ball['wicket']['type'], dismissedPlayerId: string, nextBatsmanId: string | null, runs: number, assistingPlayerId?: string, secondAssistingPlayerId?: string) => void;
    currentInning: Inning;
    players: Player[];
    bowlingTeamPlayers: Player[];
}> = ({ isOpen, onClose, onRecord, currentInning, players, bowlingTeamPlayers }) => {
    const [dismissedPlayerId, setDismissedPlayerId] = useState(currentInning.onStrikeBatsmanId);
    const [dismissalType, setDismissalType] = useState<Ball['wicket']['type']>('Bowled');
    const [nextBatsmanId, setNextBatsmanId] = useState('');
    const [runs, setRuns] = useState(0);
    const [assistingPlayerId, setAssistingPlayerId] = useState('');
    const [secondAssistingPlayerId, setSecondAssistingPlayerId] = useState('');
    
    const battingTeamPlayers = Object.keys(currentInning.batsmanStats);
    
    const availableBatsmen = players.filter(p => 
        battingTeamPlayers.includes(p.id) && 
        !currentInning.batsmanStats[p.id]?.isOut && 
        p.id !== currentInning.onStrikeBatsmanId && 
        p.id !== currentInning.nonStrikeBatsmanId
    );

    useEffect(() => {
        if(isOpen) {
            setDismissedPlayerId(currentInning.onStrikeBatsmanId);
            setDismissalType('Bowled');
            setRuns(0);
            setAssistingPlayerId('');
            setSecondAssistingPlayerId('');
            if(availableBatsmen.length > 0) {
                setNextBatsmanId(availableBatsmen[0].id);
            } else {
                setNextBatsmanId('');
            }
        }
    }, [isOpen, currentInning.onStrikeBatsmanId, players, currentInning.batsmanStats]);
    
    const handleSubmit = () => {
        const finalNextBatsmanId = currentInning.wickets < (currentInning.batsmanStats ? Object.keys(currentInning.batsmanStats).length : 11) - 1 ? nextBatsmanId : null;
        onRecord(dismissalType, dismissedPlayerId, finalNextBatsmanId, runs, assistingPlayerId || undefined, secondAssistingPlayerId || undefined);
        onClose();
    };
    
    const isAllOut = currentInning.wickets >= (currentInning.batsmanStats ? Object.keys(currentInning.batsmanStats).length : 11) - 1;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Wicket">
            <div className="space-y-4">
                <Select label="Batsman Out" value={dismissedPlayerId} onChange={e => setDismissedPlayerId(e.target.value)}>
                    <option value={currentInning.onStrikeBatsmanId}>{players.find(p => p.id === currentInning.onStrikeBatsmanId)?.name} (Striker)</option>
                    <option value={currentInning.nonStrikeBatsmanId}>{players.find(p => p.id === currentInning.nonStrikeBatsmanId)?.name}</option>
                </Select>
                <Select label="Dismissal Type" value={dismissalType} onChange={e => setDismissalType(e.target.value as any)}>
                    <option>Bowled</option>
                    <option>Caught</option>
                    <option>LBW</option>
                    <option>Run Out</option>
                    <option>Stumped</option>
                </Select>

                {dismissalType === 'Caught' && (
                    <Select label="Caught By (Optional)" value={assistingPlayerId} onChange={e => setAssistingPlayerId(e.target.value)}>
                        <option value="">Select Fielder</option>
                        {bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                )}

                {dismissalType === 'Run Out' && (
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Fielder 1 (Optional)" value={assistingPlayerId} onChange={e => setAssistingPlayerId(e.target.value)}>
                            <option value="">Select Fielder</option>
                            {bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                        <Select label="Fielder 2 (Optional)" value={secondAssistingPlayerId} onChange={e => setSecondAssistingPlayerId(e.target.value)}>
                            <option value="">Select Fielder</option>
                            {bowlingTeamPlayers.filter(p => p.id !== assistingPlayerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </div>
                )}
                
                {dismissalType === 'Stumped' && (
                    <Select label="Stumped By (Optional)" value={assistingPlayerId} onChange={e => setAssistingPlayerId(e.target.value)}>
                        <option value="">Select Wicket-Keeper</option>
                        {bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                )}
                
                <Input label="Runs on this ball (off the bat)" type="number" min="0" value={runs} onChange={e => setRuns(parseInt(e.target.value, 10) || 0)} />
                 {!isAllOut && availableBatsmen.length > 0 && (
                     <Select label="Next Batsman" value={nextBatsmanId} onChange={e => setNextBatsmanId(e.target.value)}>
                        {availableBatsmen.map(p => <option key={p.id} value={p.id}>{p.name} {currentInning.batsmanStats[p.id]?.retirementReason ? '(Retired)' : ''}</option>)}
                     </Select>
                 )}
                 <div className="flex justify-end pt-2">
                    <Button onClick={handleSubmit}>Confirm Wicket</Button>
                </div>
            </div>
        </Modal>
    )
};

const SelectBowlerModal: React.FC<{
    isOpen: boolean;
    onSelect: (bowlerId: string) => void;
    currentInning: Inning;
    bowlingTeam: Team;
    players: Player[];
}> = ({ isOpen, onSelect, currentInning, bowlingTeam, players }) => {
    
    const [selectedBowlerId, setSelectedBowlerId] = useState('');

    useEffect(() => {
        if (isOpen) {
            const availableBowlers = players.filter(p => 
                bowlingTeam.playerIds.includes(p.id) && 
                p.id !== currentInning.currentBowlerId
            );
            if (availableBowlers.length > 0) {
                setSelectedBowlerId(availableBowlers[0].id);
            }
        }
    }, [isOpen, players, bowlingTeam, currentInning.currentBowlerId]);

    const handleSubmit = () => {
        if(selectedBowlerId) {
            onSelect(selectedBowlerId);
        }
    };
    
    const availableBowlers = players.filter(p => 
        bowlingTeam.playerIds.includes(p.id) && 
        p.id !== currentInning.currentBowlerId
    );

    return (
        <Modal isOpen={isOpen} title="Select Next Bowler">
            <div className="space-y-4">
                <p className="text-text-secondary">Select the bowler for the next over.</p>
                <Select label="Bowler" value={selectedBowlerId} onChange={e => setSelectedBowlerId(e.target.value)}>
                    {availableBowlers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSubmit} disabled={!selectedBowlerId}>Confirm Bowler</Button>
                </div>
            </div>
        </Modal>
    );
};

const RetireBatsmanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (retiredBatsmanId: string, newBatsmanId: string, reason: string) => void;
    currentInning: Inning;
    players: Player[];
}> = ({ isOpen, onClose, onConfirm, currentInning, players }) => {
    const [retiredBatsmanId, setRetiredBatsmanId] = useState('');
    const [newBatsmanId, setNewBatsmanId] = useState('');
    const [reason, setReason] = useState('Retired Hurt');

    const battingTeamPlayers = Object.keys(currentInning.batsmanStats);
    const availableBatsmen = players.filter(p => 
        battingTeamPlayers.includes(p.id) && 
        !currentInning.batsmanStats[p.id]?.isOut &&
        !currentInning.batsmanStats[p.id]?.retirementReason &&
        p.id !== currentInning.onStrikeBatsmanId && 
        p.id !== currentInning.nonStrikeBatsmanId
    );
    
    useEffect(() => {
        if (isOpen) {
            setRetiredBatsmanId(currentInning.onStrikeBatsmanId);
            setReason('Retired Hurt');
            if (availableBatsmen.length > 0) {
                setNewBatsmanId(availableBatsmen[0].id);
            } else {
                setNewBatsmanId('');
            }
        }
    }, [isOpen, currentInning.onStrikeBatsmanId]);

    const handleSubmit = () => {
        if (retiredBatsmanId && newBatsmanId && reason.trim()) {
            onConfirm(retiredBatsmanId, newBatsmanId, reason.trim());
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Retire Batsman">
            <div className="space-y-4">
                <Select label="Batsman to Retire" value={retiredBatsmanId} onChange={e => setRetiredBatsmanId(e.target.value)}>
                    <option value={currentInning.onStrikeBatsmanId}>{players.find(p => p.id === currentInning.onStrikeBatsmanId)?.name} (Striker)</option>
                    <option value={currentInning.nonStrikeBatsmanId}>{players.find(p => p.id === currentInning.nonStrikeBatsmanId)?.name}</option>
                </Select>
                
                {availableBatsmen.length > 0 ? (
                    <Select label="Replacement Batsman" value={newBatsmanId} onChange={e => setNewBatsmanId(e.target.value)}>
                        {availableBatsmen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                ) : (
                    <p className="text-sm text-accent-yellow">No available batsmen to come in.</p>
                )}

                <Input label="Reason for Retirement" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Retired Hurt" />
                
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSubmit} disabled={!retiredBatsmanId || !newBatsmanId || !reason.trim()}>
                        Confirm Retirement
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const Scorecard: React.FC<{ match: Match; teams: Team[]; players: Player[] }> = ({ match, teams, players }) => {
    const scorecardRef = useRef<HTMLDivElement>(null);

    const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown Player';
    const getTeamName = (id:string) => teams.find(t => t.id === id)?.name || 'Unknown Team';

    const getDismissalInfo = (inning: Inning, batsmanId: string): string => {
        const stats = inning.batsmanStats[batsmanId];
        if (stats?.retirementReason) {
            return stats.retirementReason;
        }

        const wicketBall = inning.timeline.find(b => b.wicket?.playerId === batsmanId);
        if (!wicketBall || !wicketBall.wicket) return "not out";

        const bowlerName = getPlayerName(wicketBall.bowlerId);
        const { type, assistingPlayerId, secondAssistingPlayerId } = wicketBall.wicket;

        switch (type) {
            case "Bowled": return `b ${bowlerName}`;
            case "LBW": return `lbw b ${bowlerName}`;
            case "Caught": {
                const catcherName = assistingPlayerId ? getPlayerName(assistingPlayerId) : null;
                if (catcherName && catcherName === bowlerName) {
                    return `c & b ${bowlerName}`;
                }
                if (catcherName) {
                    return `c ${catcherName} b ${bowlerName}`;
                }
                return `caught b ${bowlerName}`;
            }
            case "Stumped": {
                const keeperName = assistingPlayerId ? getPlayerName(assistingPlayerId) : null;
                return `st ${keeperName || 'wk'} b ${bowlerName}`;
            }
            case "Run Out": {
                const fielders = [assistingPlayerId, secondAssistingPlayerId]
                    .filter(id => !!id)
                    .map(id => getPlayerName(id!));
                
                if (fielders.length > 0) {
                    return `run out (${fielders.join('/')})`;
                }
                return "run out";
            }
            default: return "out";
        }
    };

    const exportAsImage = () => {
        if (scorecardRef.current && typeof html2canvas !== 'undefined') {
            html2canvas(scorecardRef.current, {
                backgroundColor: '#121212',
                scale: 2,
                ignoreElements: (element) => element.classList.contains('ignore-export')
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `scorecard-${getTeamName(match.teamAId)}-vs-${getTeamName(match.teamBId)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }
    };

    const exportAsPdf = () => {
        if (scorecardRef.current && typeof jspdf !== 'undefined' && typeof html2canvas !== 'undefined') {
            const { jsPDF } = jspdf;
            html2canvas(scorecardRef.current, {
                backgroundColor: '#121212',
                scale: 2,
                ignoreElements: (element) => element.classList.contains('ignore-export')
            }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`scorecard-${getTeamName(match.teamAId)}-vs-${getTeamName(match.teamBId)}.pdf`);
            });
        }
    };
    
    const exportAsJson = () => {
        // Get all player IDs involved in the match
        const playerIdsInMatch = new Set([...match.teamAPlayers, ...match.teamBPlayers]);
        
        // Filter the main players list to get full player objects
        const playersData = players.filter(p => playerIdsInMatch.has(p.id));

        // Get the two teams' full objects
        const teamsData = teams.filter(t => t.id === match.teamAId || t.id === match.teamBId);

        // Create the comprehensive export object
        const exportData = {
            matchData: match,
            playersData: playersData,
            teamsData: teamsData,
        };

        const matchJson = JSON.stringify(exportData, null, 2);
        const blob = new Blob([matchJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `match-${getTeamName(match.teamAId)}-vs-${getTeamName(match.teamBId)}-${match.id}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const renderInning = (inning: Inning, inningNum: number) => {
        const battingTeam = getTeamName(inning.battingTeamId);
        const battingTeamPlayerIds = inning.battingTeamId === match.teamAId ? match.teamAPlayers : match.teamBPlayers;
        
        const didNotBatIds = battingTeamPlayerIds.filter(pId => !inning.batsmanStats[pId] || (inning.batsmanStats[pId].balls === 0 && !inning.batsmanStats[pId].isOut && !inning.batsmanStats[pId].retirementReason));

        const extrasBreakdown = inning.timeline.reduce((acc, ball) => {
            if (ball.event === 'Wide') acc.wd += 1;
            if (ball.event === 'No Ball') acc.nb += 1;
            if (ball.event === 'Bye') acc.b += ball.extras;
            if (ball.event === 'Leg Bye') acc.lb += ball.extras;
            return acc;
        }, { wd: 0, nb: 0, b: 0, lb: 0 });

        const totalExtras = inning.timeline.reduce((acc, b) => acc + b.extras, 0);

        const extrasString = `(wd ${extrasBreakdown.wd}, nb ${extrasBreakdown.nb}, b ${extrasBreakdown.b}, lb ${extrasBreakdown.lb})`;

        const bowlerStatsWithExtras = Object.entries(inning.bowlerStats)
            .map(([pId, stats]) => {
                if(stats.overs === 0 && stats.balls === 0) return null;
                const bowlerBalls = inning.timeline.filter(b => b.bowlerId === pId);
                const wides = bowlerBalls.filter(b => b.event === 'Wide').length;
                const noBalls = bowlerBalls.filter(b => b.event === 'No Ball').length;
                const totalBalls = stats.overs * 6 + stats.balls;
                const econ = totalBalls > 0 ? ((stats.runsConceded / totalBalls) * 6).toFixed(2) : "0.00";
                return { pId, stats, wides, noBalls, econ };
            }).filter(Boolean);

        return (
            <Card key={inningNum} className="overflow-hidden !p-0">
                <div className="bg-light-gray p-3 md:p-4">
                    <div className="flex justify-between items-baseline">
                        <h3 className="text-xl font-bold">{`${battingTeam} Innings`}</h3>
                        <p className="text-2xl font-bold">{inning.score}/{inning.wickets} <span className="text-base font-normal text-text-secondary">({inning.overs}.{inning.balls} Overs)</span></p>
                    </div>
                </div>
                <div className="p-4 md:p-6 space-y-6">
                    {/* Batting Section */}
                    <div>
                        {/* Desktop Table */}
                        <div className="overflow-x-auto hidden md:block">
                            <table className="w-full text-left">
                                <thead className="border-b border-light-gray text-text-secondary">
                                    <tr>
                                        <th className="p-3 text-sm font-bold w-2/5">BATSMAN</th>
                                        <th className="p-3 text-sm font-bold w-2/5">DISMISSAL</th>
                                        <th className="p-3 text-sm font-bold text-right">R</th>
                                        <th className="p-3 text-sm font-bold text-right">B</th>
                                        <th className="p-3 text-sm font-bold text-right">4S</th>
                                        <th className="p-3 text-sm font-bold text-right">6S</th>
                                        <th className="p-3 text-sm font-bold text-right">SR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(inning.batsmanStats).map(([pId, stats]) => {
                                        if (stats.balls === 0 && !stats.isOut && !stats.retirementReason) return null;
                                        const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(2) : "0.00";
                                        return (
                                            <tr key={pId} className="border-b border-light-gray last:border-0 font-mono text-sm even:bg-light-gray/20">
                                                <td className="p-3 font-sans font-semibold text-base">{getPlayerName(pId)}</td>
                                                <td className="p-3 text-xs text-text-secondary">{getDismissalInfo(inning, pId)}</td>
                                                <td className="p-3 text-right font-bold">{stats.runs}</td>
                                                <td className="p-3 text-right">{stats.balls}</td>
                                                <td className="p-3 text-right">{stats.fours}</td>
                                                <td className="p-3 text-right">{stats.sixes}</td>
                                                <td className="p-3 text-right">{sr}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="border-t-2 border-light-gray">
                                    <tr className="font-mono text-sm">
                                        <td className="p-3 font-sans font-semibold">Extras</td>
                                        <td colSpan={5} className="p-3 text-xs text-text-secondary">{extrasString}</td>
                                        <td className="p-3 text-right font-bold">{totalExtras}</td>
                                    </tr>
                                    <tr className="font-mono text-base">
                                        <td className="p-3 font-sans font-bold text-lg">Total</td>
                                        <td colSpan={5}></td>
                                        <td className="p-3 text-right font-bold text-lg">{inning.score}/{inning.wickets}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Mobile Card List */}
                        <div className="md:hidden space-y-3">
                            {Object.entries(inning.batsmanStats).map(([pId, stats]) => {
                                if (stats.balls === 0 && !stats.isOut && !stats.retirementReason) return null;
                                const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(2) : "0.00";
                                return (
                                    <div key={pId} className="bg-light-gray/50 p-3 rounded-lg">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold text-base">{getPlayerName(pId)}</p>
                                            <p className="font-bold text-lg">{stats.runs} <span className="text-sm font-normal text-text-secondary">({stats.balls})</span></p>
                                        </div>
                                        <p className="text-xs text-text-secondary mt-1">{getDismissalInfo(inning, pId)}</p>
                                        <div className="flex justify-end space-x-4 mt-2 text-xs font-mono">
                                            <span>4s: {stats.fours}</span>
                                            <span>6s: {stats.sixes}</span>
                                            <span>SR: {sr}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="text-base font-mono flex justify-between pt-4 border-t border-light-gray">
                                <span>Extras: {totalExtras}</span>
                                <span className="font-bold">Total: {inning.score}/{inning.wickets}</span>
                            </div>
                        </div>
                    </div>

                    {didNotBatIds.length > 0 && <p className="text-sm text-text-secondary pt-2">Did not bat: {didNotBatIds.map(getPlayerName).join(', ')}</p>}

                    {inning.fallOfWickets.length > 0 &&
                        <div>
                            <h4 className="font-semibold mt-4 text-base">Fall of Wickets</h4>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                {inning.fallOfWickets.map(fow => `${fow.score}-${fow.wicket} (${getPlayerName(fow.playerId)}, ${Math.floor(fow.over)}.${Math.round((fow.over % 1) * 10)})`).join('; ')}
                            </p>
                        </div>
                    }

                    {/* Bowling Section */}
                    <div className="pt-4">
                        {/* Desktop Table */}
                        <div className="overflow-x-auto hidden md:block">
                            <table className="w-full text-left">
                                <thead className="border-b border-light-gray text-text-secondary">
                                    <tr>
                                        <th className="p-3 text-sm font-bold w-2/5">BOWLER</th>
                                        <th className="p-3 text-sm font-bold text-right">O</th>
                                        <th className="p-3 text-sm font-bold text-right">M</th>
                                        <th className="p-3 text-sm font-bold text-right">R</th>
                                        <th className="p-3 text-sm font-bold text-right">W</th>
                                        <th className="p-3 text-sm font-bold text-right">WD</th>
                                        <th className="p-3 text-sm font-bold text-right">NB</th>
                                        <th className="p-3 text-sm font-bold text-right">ECON</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bowlerStatsWithExtras.map(bs => {
                                        if (!bs) return null;
                                        const {pId, stats, wides, noBalls, econ} = bs;
                                        return (
                                            <tr key={pId} className="border-b border-light-gray last:border-0 font-mono text-sm even:bg-light-gray/20">
                                                <td className="p-3 font-sans font-semibold text-base">{getPlayerName(pId)}</td>
                                                <td className="p-3 text-right">{stats.overs}.{stats.balls}</td>
                                                <td className="p-3 text-right">{stats.maidens}</td>
                                                <td className="p-3 text-right">{stats.runsConceded}</td>
                                                <td className="p-3 text-right font-bold">{stats.wickets}</td>
                                                <td className="p-3 text-right">{wides}</td>
                                                <td className="p-3 text-right">{noBalls}</td>
                                                <td className="p-3 text-right">{econ}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile Card List */}
                        <div className="md:hidden space-y-3">
                             {bowlerStatsWithExtras.map(bs => {
                                if (!bs) return null;
                                const {pId, stats, wides, noBalls, econ} = bs;
                                return (
                                     <div key={pId} className="bg-light-gray/50 p-3 rounded-lg">
                                        <p className="font-semibold text-base">{getPlayerName(pId)}</p>
                                        <div className="grid grid-cols-7 gap-1 mt-2 text-center text-xs font-mono">
                                            <div><p className="text-text-secondary">O</p><p>{stats.overs}.{stats.balls}</p></div>
                                            <div><p className="text-text-secondary">M</p><p>{stats.maidens}</p></div>
                                            <div><p className="text-text-secondary">R</p><p>{stats.runsConceded}</p></div>
                                            <div><p className="text-text-secondary">W</p><p>{stats.wickets}</p></div>
                                            <div><p className="text-text-secondary">WD</p><p>{wides}</p></div>
                                            <div><p className="text-text-secondary">NB</p><p>{noBalls}</p></div>
                                            <div><p className="text-text-secondary">Econ</p><p>{econ}</p></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </Card>
        );
    };
    
    return (
        <div ref={scorecardRef} className="space-y-6">
            <Card className="!p-0 overflow-hidden">
                <div className="p-4 md:p-6 bg-night-gray">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-grow">
                            <h2 className="text-2xl md:text-3xl font-bold">{getTeamName(match.teamAId)} vs {getTeamName(match.teamBId)}</h2>
                            <p className="text-sm text-text-secondary">{match.settings.overs}-Overs Match</p>
                        </div>
                        <div className="ignore-export flex items-center space-x-2 self-end md:self-center">
                            <span className="text-sm text-text-secondary hidden md:inline">Export:</span>
                            <Button onClick={exportAsImage} variant="secondary" size="sm">Image</Button>
                            <Button onClick={exportAsPdf} variant="secondary" size="sm">PDF</Button>
                            <Button onClick={exportAsJson} variant="secondary" size="sm">JSON</Button>
                        </div>
                    </div>
                </div>
                 <div className="p-4 md:p-6 border-t border-light-gray">
                     <p className="text-lg md:text-xl text-cricket-green font-bold">{match.resultText || 'Match in Progress'}</p>
                 </div>
            </Card>
            {renderInning(match.inning1, 1)}
            {match.inning2 && renderInning(match.inning2, 2)}
        </div>
    );
};

const ScorecardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  teams: Team[];
  players: Player[];
}> = ({ isOpen, onClose, match, teams, players }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Full Scorecard" size="5xl">
            <Scorecard match={match} teams={teams} players={players} />
        </Modal>
    );
};


// Page Components & Modals
const OpeningPlayerSelectionPage: React.FC = () => {
    const { activeMatch, players, teams, updateMatch } = useApp();
    const [strikerId, setStrikerId] = useState('');
    const [nonStrikerId, setNonStrikerId] = useState('');
    const [bowlerId, setBowlerId] = useState('');
    const [error, setError] = useState('');

    const inning = activeMatch?.inning2 || activeMatch?.inning1;
    const battingTeamId = inning?.battingTeamId;
    const bowlingTeamId = inning?.bowlingTeamId;

    const battingTeam = teams.find(t => t.id === battingTeamId);
    const bowlingTeam = teams.find(t => t.id === bowlingTeamId);

    const battingTeamPlayers = (battingTeamId === activeMatch?.teamAId ? activeMatch?.teamAPlayers : activeMatch?.teamBPlayers)?.map(pId => players.find(p => p.id === pId)).filter(Boolean) as Player[] || [];
    const bowlingTeamPlayers = (bowlingTeamId === activeMatch?.teamAId ? activeMatch?.teamAPlayers : activeMatch?.teamBPlayers)?.map(pId => players.find(p => p.id === pId)).filter(Boolean) as Player[] || [];


    useEffect(() => {
        if (battingTeamPlayers.length >= 2) {
            setStrikerId(battingTeamPlayers[0].id);
            setNonStrikerId(battingTeamPlayers[1].id);
        }
        if (bowlingTeamPlayers.length >= 1) {
            setBowlerId(bowlingTeamPlayers[0].id);
        }
    }, [activeMatch?.id, battingTeam?.id, bowlingTeam?.id]); // Rerun when match or teams change

    if (!activeMatch) return null;
    
    // Defensive check to avoid crash if teams/players are not found yet
    if (!battingTeam || !bowlingTeam) {
        return <div className="text-center p-8">Loading team data...</div>;
    }

    const handleStartMatch = async () => {
        setError('');
        if (!strikerId || !nonStrikerId || !bowlerId) {
            setError('Please select two opening batsmen and a bowler.');
            return;
        }
        if (strikerId === nonStrikerId) {
            setError('Striker and non-striker cannot be the same player.');
            return;
        }

        const updatedMatch = produce(activeMatch, draft => {
            const currentInning = draft.inning2 || draft.inning1;
            draft.status = 'In Progress';
            currentInning.onStrikeBatsmanId = strikerId;
            currentInning.nonStrikeBatsmanId = nonStrikerId;
            currentInning.currentBowlerId = bowlerId;
            currentInning.awaitingNextBowler = false; // Important for 2nd inning
        });

        await updateMatch(updatedMatch);
    };

    return (
        <Card className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">Select Opening Players</h2>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <div>
                    <h3 className="text-xl font-semibold mb-4 text-cricket-green text-center">Batting Team: {battingTeam.name}</h3>
                    <div className="space-y-6 bg-light-gray p-6 rounded-lg">
                        <Select label="On-Strike Batsman" value={strikerId} onChange={e => {
                            const newStrikerId = e.target.value;
                            if (newStrikerId === nonStrikerId) setNonStrikerId(strikerId);
                            setStrikerId(newStrikerId);
                        }}>
                            {battingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                        <Select label="Non-Strike Batsman" value={nonStrikerId} onChange={e => {
                            const newNonStrikerId = e.target.value;
                            if (newNonStrikerId === strikerId) setStrikerId(nonStrikerId);
                            setNonStrikerId(newNonStrikerId);
                        }}>
                            {battingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-4 text-accent-yellow text-center">Bowling Team: {bowlingTeam.name}</h3>
                    <div className="space-y-6 bg-light-gray p-6 rounded-lg">
                        <Select label="Opening Bowler" value={bowlerId} onChange={e => setBowlerId(e.target.value)}>
                            {bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </div>
                </div>
            </div>
             <div className="mt-8 flex flex-col items-center justify-center">
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <Button onClick={handleStartMatch} size="lg">Start Scoring</Button>
            </div>
        </Card>
    );
};

const BallDisplay: React.FC<{ ball: Ball, settings: MatchSettings }> = ({ ball, settings }) => {
    let content: string | number = ball.runs;
    let classes = 'bg-light-gray text-text-primary';

    const noBallRuns = settings.noBallRuns ?? 2;
    const wideRuns = settings.wideRuns ?? 2;

    if (ball.event === 'Wicket') {
        content = `W${ball.runs > 0 ? `+${ball.runs}` : ''}`;
        classes = 'bg-red-600 text-white';
    } else if (ball.event === 'Wide') {
        const additionalRuns = ball.extras - wideRuns;
        content = `Wd${additionalRuns > 0 ? `+${additionalRuns}` : ''}`;
        classes = 'bg-purple-500 text-white';
    } else if (ball.event === 'No Ball') {
        const totalRuns = ball.runs + ball.extras - noBallRuns;
        content = `Nb${totalRuns > 0 ? `+${totalRuns}`: ''}`;
        classes = 'bg-purple-500 text-white';
    } else if (ball.event === 'Bye' || ball.event === 'Leg Bye') {
        content = `${ball.extras}${ball.event === 'Bye' ? 'b' : 'lb'}`;
        classes = 'bg-gray-500 text-white';
    } else if (ball.runs === 4) {
        content = 4;
        classes = 'bg-accent-blue text-white';
    } else if (ball.runs === 6) {
        content = 6;
        classes = 'bg-accent-yellow text-pitch-dark font-black';
    } else if (ball.runs === 0 && ball.extras === 0) {
        content = '•';
    }
    
    const baseClasses = 'w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm';
    return <div className={`${baseClasses} ${classes}`}>{content}</div>;
};

const InningsTimeline: React.FC<{ inning: Inning; players: Player[]; settings: MatchSettings }> = ({ inning, players, settings }) => {
    const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

    // Group balls by over number from timeline
    const oversData = inning.timeline.reduce((acc, ball) => {
        const overNum = ball.overNumber;
        if (!acc[overNum]) {
            acc[overNum] = [];
        }
        acc[overNum].push(ball);
        return acc;
    }, {} as Record<number, Ball[]>);

    // Get sorted over numbers that have balls
    const bowledOverNumbers = Object.keys(oversData).map(Number).sort((a, b) => b - a);

    const hasNoBallsBowled = inning.timeline.length === 0;

    return (
        <Card>
            <h3 className="text-lg font-semibold mb-3">Ball-by-Ball</h3>
            <div className="space-y-4 max-h-[26rem] overflow-y-auto pr-2">
                {/* Render current over if it's new and has no balls */}
                {bowledOverNumbers[0] !== inning.overs && !hasNoBallsBowled && inning.currentBowlerId && (
                    <div className="border-b border-light-gray pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center text-sm mb-2">
                            <p><span className="font-bold">Over {inning.overs + 1}</span> <span className="text-text-secondary">({getPlayerName(inning.currentBowlerId)})</span></p>
                            <p className="font-bold">0 Runs</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <p className="text-text-secondary text-xs">Over in progress...</p>
                        </div>
                    </div>
                )}
                
                {/* Render overs that have balls */}
                {bowledOverNumbers.map(overNum => {
                    const overBalls = oversData[overNum];
                    if (!overBalls || overBalls.length === 0) return null;
                    const bowlerName = getPlayerName(overBalls[0].bowlerId);
                    const runsInOver = overBalls.reduce((sum, ball) => sum + ball.runs + ball.extras, 0);

                    return (
                        <div key={overNum} className="border-b border-light-gray pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center text-sm mb-2">
                                <p><span className="font-bold">Over {overNum + 1}</span> <span className="text-text-secondary">({bowlerName})</span></p>
                                <p className="font-bold">{runsInOver} Runs</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {overBalls.map((ball, index) => (
                                    <BallDisplay key={index} ball={ball} settings={settings} />
                                ))}
                            </div>
                        </div>
                    );
                })}
                
                {/* Handle the very first ball of the innings */}
                {hasNoBallsBowled && inning.currentBowlerId && (
                    <div className="pb-2">
                        <div className="flex justify-between items-center text-sm mb-2">
                             <p><span className="font-bold">Over 1</span> <span className="text-text-secondary">({getPlayerName(inning.currentBowlerId)})</span></p>
                             <p className="font-bold">0 Runs</p>
                        </div>
                        <p className="text-text-secondary text-xs">First ball of the innings.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

const LiveScoringPage: React.FC<{
    history: Match[];
    addToHistory: (match: Match) => void;
    handleUndo: () => Promise<void>;
}> = ({ history, addToHistory, handleUndo }) => {
    const { activeMatch, teams, players, updateMatch } = useApp();
    const [isExtrasModalOpen, setIsExtrasModalOpen] = useState(false);
    const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
    const [isScorecardModalOpen, setIsScorecardModalOpen] = useState(false);
    const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
    const [isRetireModalOpen, setIsRetireModalOpen] = useState(false);

    if (!activeMatch) return <div className="text-center p-8">No active match found.</div>;

    const handleRecordDelivery = useCallback(async (event: ScoreEventType) => {
        if (!activeMatch) return;
        addToHistory(activeMatch);
        const updatedMatch = processDelivery(activeMatch, event, teams);
        await updateMatch(updatedMatch);
    }, [activeMatch, updateMatch, teams, addToHistory]);
    
    const handleSettingsChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeMatch) return;
        const { name, value, type, checked } = e.target;

        const updatedMatch = produce(activeMatch, draft => {
            const settings = draft.settings;
            if (type === 'checkbox') {
                // Set the value for the changed checkbox
                (settings as any)[name] = checked;

                // Apply mutual exclusivity rules
                if (name === 'rebowlWide') {
                    if (checked) {
                        settings.rebowlWideLastBallOfOver = false;
                        settings.rebowlWideAllInLastOver = false;
                    }
                } else if (name === 'rebowlWideLastBallOfOver' || name === 'rebowlWideAllInLastOver') {
                    if (checked) {
                        settings.rebowlWide = false;
                    }
                } else if (name === 'rebowlNoBall') {
                    if (checked) {
                        settings.rebowlNoBallLastBallOfOver = false;
                        settings.rebowlNoBallAllInLastOver = false;
                    }
                } else if (name === 'rebowlNoBallLastBallOfOver' || name === 'rebowlNoBallAllInLastOver') {
                    if (checked) {
                        settings.rebowlNoBall = false;
                    }
                }
            } else {
                (settings as any)[name] = parseInt(value, 10) || 0;
            }
        });
        await updateMatch(updatedMatch);
    }, [activeMatch, updateMatch]);

    const handleSwapBatsmen = useCallback(async () => {
        if (!activeMatch) return;
        addToHistory(activeMatch);
        const updatedMatch = produce(activeMatch, draft => {
            const currentInning = draft.inning2 || draft.inning1;
            [currentInning.onStrikeBatsmanId, currentInning.nonStrikeBatsmanId] = 
                [currentInning.nonStrikeBatsmanId, currentInning.onStrikeBatsmanId];
        });
        await updateMatch(updatedMatch);
    }, [activeMatch, updateMatch, addToHistory]);

    const handleRetireBatsman = useCallback(async (retiredBatsmanId: string, newBatsmanId: string, reason: string) => {
        if (!activeMatch) return;
        addToHistory(activeMatch);
        
        const updatedMatch = produce(activeMatch, draft => {
            const currentInning = draft.inning2 || draft.inning1;
            if (currentInning.batsmanStats[retiredBatsmanId]) {
                currentInning.batsmanStats[retiredBatsmanId].retirementReason = reason;
            }
            if (currentInning.onStrikeBatsmanId === retiredBatsmanId) {
                currentInning.onStrikeBatsmanId = newBatsmanId;
            } else if (currentInning.nonStrikeBatsmanId === retiredBatsmanId) {
                currentInning.nonStrikeBatsmanId = newBatsmanId;
            }
        });
        
        await updateMatch(updatedMatch);
        setIsRetireModalOpen(false);
    }, [activeMatch, updateMatch, addToHistory]);

    const handleDeclareInnings = useCallback(async () => {
        if (!activeMatch) return;

        addToHistory(activeMatch);
        const updatedMatch = produce(activeMatch, draft => {
            const isFirstInning = !draft.inning2;

            if (isFirstInning) {
                const newBattingTeamId = draft.inning1.bowlingTeamId;
                const newBowlingTeamId = draft.inning1.battingTeamId;
                
                const newBattingTeamPlayers = newBattingTeamId === draft.teamAId ? draft.teamAPlayers : draft.teamBPlayers;
                const newBowlingTeamPlayers = newBowlingTeamId === draft.teamAId ? draft.teamAPlayers : draft.teamBPlayers;

                draft.inning2 = {
                    battingTeamId: newBattingTeamId,
                    bowlingTeamId: newBowlingTeamId,
                    score: 0, wickets: 0, overs: 0, balls: 0, timeline: [],
                    batsmanStats: Object.fromEntries(newBattingTeamPlayers.map(pId => [pId, { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false }])),
                    bowlerStats: Object.fromEntries(newBowlingTeamPlayers.map(pId => [pId, { overs: 0, balls: 0, runsConceded: 0, wickets: 0, maidens: 0 }])),
                    onStrikeBatsmanId: '',
                    nonStrikeBatsmanId: '',
                    currentBowlerId: '',
                    fallOfWickets: [],
                    awaitingNextBowler: true,
                };
                draft.status = 'Upcoming';
            } else {
                draft.status = 'Finished';
                const score1 = draft.inning1.score;
                const score2 = draft.inning2!.score;
                if (score2 > score1) {
                    draft.winnerTeamId = draft.inning2!.battingTeamId;
                    const wicketsInHand = (draft.settings.playersPerTeam - 1) - draft.inning2!.wickets;
                    draft.resultText = `${teams.find(t=>t.id===draft.winnerTeamId)?.name} won by ${wicketsInHand} wickets.`;
                } else if (score1 > score2) {
                    draft.winnerTeamId = draft.inning1.battingTeamId;
                    draft.resultText = `${teams.find(t=>t.id===draft.winnerTeamId)?.name} won by ${score1 - score2} runs.`;
                } else {
                    draft.resultText = 'Match Tied.';
                }
            }
        });
        
        await updateMatch(updatedMatch);
        setIsDeclareModalOpen(false);
    }, [activeMatch, updateMatch, teams, addToHistory]);

    if (activeMatch.status === 'Finished') {
        return (
            <div className="space-y-6">
                <Scorecard match={activeMatch} teams={teams} players={players} />
                <div className="flex justify-center">
                    <Button 
                        onClick={handleUndo} 
                        disabled={history.length === 0}
                        variant="secondary"
                        className="flex items-center space-x-2"
                    >
                        <RotateCcwIcon className="w-5 h-5" />
                        <span>Undo Last Action</span>
                    </Button>
                </div>
            </div>
        );
    }

    const { inning1, inning2 } = activeMatch;
    const currentInning = inning2 || inning1;
    const battingTeam = teams.find(t => t.id === currentInning.battingTeamId);
    const bowlingTeam = teams.find(t => t.id === currentInning.bowlingTeamId);
    
    const onStrikeBatsman = players.find(p => p.id === currentInning.onStrikeBatsmanId);
    const nonStrikeBatsman = players.find(p => p.id === currentInning.nonStrikeBatsmanId);
    const currentBowler = players.find(p => p.id === currentInning.currentBowlerId);
    const bowlingTeamPlayers = players.filter(p => bowlingTeam?.playerIds.includes(p.id));

    const isAwaitingNextBowler = !!currentInning.awaitingNextBowler;

    const handleSelectBowler = async (newBowlerId: string) => {
        const updatedMatch = produce(activeMatch, draft => {
            const inningToUpdate = draft.inning2 || draft.inning1;
            inningToUpdate.currentBowlerId = newBowlerId;
            inningToUpdate.awaitingNextBowler = false;
        });
        await updateMatch(updatedMatch);
    };

    // Defensive fallback to prevent UI crash
    const onStrikeStats = currentInning.batsmanStats[currentInning.onStrikeBatsmanId] || { runs: 0, balls: 0 };
    const nonStrikeStats = currentInning.batsmanStats[currentInning.nonStrikeBatsmanId] || { runs: 0, balls: 0 };
    const bowlerStats = currentInning.bowlerStats[currentInning.currentBowlerId] || { wickets: 0, runsConceded: 0, overs: 0, balls: 0 };
    
    const isSecondInning = !!inning2;
    const ballsBowled = currentInning.overs * 6 + currentInning.balls;
    const totalBalls = activeMatch.settings.overs * 6;

    let crr = 0;
    if (ballsBowled > 0) {
        const oversAsDecimal = currentInning.overs + currentInning.balls / 6;
        crr = currentInning.score / oversAsDecimal;
    }

    let target = 0;
    let runsRequired = 0;
    let ballsRemaining = 0;
    let rrr = 0;

    if (isSecondInning) {
        target = inning1.score + 1;
        runsRequired = target - currentInning.score;
        ballsRemaining = totalBalls - ballsBowled;
        if (ballsRemaining > 0 && runsRequired > 0) {
            rrr = (runsRequired / ballsRemaining) * 6;
        }
    }

    const projectedScore = Math.round(crr * activeMatch.settings.overs);

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold">{battingTeam?.name} vs {bowlingTeam?.name}</h2>
                        <p className="text-text-secondary">{activeMatch.status}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-bold">{currentInning.score}/{currentInning.wickets}</p>
                        <p className="text-lg">Overs: {currentInning.overs}.{currentInning.balls}</p>
                    </div>
                </div>

                <div className="mt-4 border-t border-light-gray pt-4">
                    {isSecondInning ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center items-center">
                            <div className="md:col-span-1">
                                <p className="text-sm text-text-secondary">Target</p>
                                <p className="font-bold text-xl text-accent-yellow">{target}</p>
                            </div>
                            <div className="col-span-2 md:col-span-2">
                                <p className="text-lg">Need <span className="font-bold text-2xl text-text-primary">{runsRequired > 0 ? runsRequired : 0}</span> runs</p>
                                <p className="text-sm text-text-secondary">from {ballsRemaining} balls</p>
                            </div>
                            <div className="md:col-span-1">
                                <p className="text-sm text-text-secondary">Req. RR</p>
                                <p className="font-bold text-xl">{rrr > 0 ? rrr.toFixed(2) : '-'}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-sm text-text-secondary">Current RR</p>
                                <p className="font-bold text-xl">{crr > 0 ? crr.toFixed(2) : '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Projected Score</p>
                                <p className="font-bold text-xl">~{projectedScore > 0 ? projectedScore : '-'}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 border-t border-light-gray pt-4">
                    <Button variant="secondary" size="sm" onClick={() => setIsScorecardModalOpen(true)}>View Full Scorecard</Button>
                </div>
            </Card>
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <Card>
                        <h3 className="text-xl font-bold mb-2">Batting</h3>
                        <div className="flex justify-between font-mono items-center">
                            <p>{onStrikeBatsman?.name}*</p>
                            <p>{onStrikeStats.runs} ({onStrikeStats.balls})</p>
                        </div>
                         <div className="text-center -my-2">
                            <Button variant="ghost" size="sm" onClick={handleSwapBatsmen} title="Swap Batsmen">
                                <SwapIcon className="w-5 h-5 text-text-secondary hover:text-text-primary transition-colors" />
                            </Button>
                        </div>
                         <div className="flex justify-between font-mono text-text-secondary items-center">
                            <p>{nonStrikeBatsman?.name}</p>
                            <p>{nonStrikeStats.runs} ({nonStrikeStats.balls})</p>
                        </div>
                    </Card>
                     <Card>
                        <h3 className="text-xl font-bold mb-2">Bowling</h3>
                         <div className="flex justify-between font-mono">
                            <p>{currentBowler?.name}</p>
                            <p>{bowlerStats.wickets}/{bowlerStats.runsConceded} ({bowlerStats.overs}.{bowlerStats.balls})</p>
                        </div>
                    </Card>
                    <InningsTimeline inning={currentInning} players={players} settings={activeMatch.settings} />
                </div>
                <div className="space-y-6">
                     <Card className="relative">
                        <h3 className="text-xl font-bold mb-4">Record Delivery</h3>
                        <div className="space-y-2">
                            <p className="text-sm text-text-secondary">Runs Scored:</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[0, 1, 2, 3, 4, 6].map(run => <Button key={run} onClick={() => handleRecordDelivery({ type: 'RUN', runs: run })}>{run}</Button>)}
                            </div>
                            <p className="text-sm text-text-secondary pt-2">Events:</p>
                            <div className="grid grid-cols-3 gap-2">
                                <Button variant="secondary" onClick={() => setIsExtrasModalOpen(true)}>Extras</Button>
                                <Button variant="danger" onClick={() => setIsWicketModalOpen(true)}>Wicket</Button>
                                <Button variant="secondary" onClick={() => setIsRetireModalOpen(true)}>Retire</Button>
                                <Button variant="secondary" onClick={() => setIsDeclareModalOpen(true)}>Declare</Button>
                                <Button variant="secondary" onClick={handleUndo} disabled={history.length === 0} className="flex items-center justify-center space-x-2 col-span-2">
                                    <RotateCcwIcon className="w-4 h-4" />
                                    <span>Undo</span>
                                </Button>
                            </div>
                        </div>
                        {isAwaitingNextBowler && (
                            <div className="absolute inset-0 bg-night-gray bg-opacity-80 flex items-center justify-center rounded-lg">
                                <p className="text-center text-accent-yellow p-4">Select the next bowler to continue scoring.</p>
                            </div>
                        )}
                    </Card>
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Live Match Rules</h3>
                        <div className="space-y-3">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-sm text-text-secondary mb-2">Wide Re-bowl Rules</h4>
                                    <div className="space-y-2 bg-pitch-dark p-3 rounded-md">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="rebowlWide" className={`text-sm text-text-primary ${(activeMatch.settings.rebowlWideLastBallOfOver || activeMatch.settings.rebowlWideAllInLastOver) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={(activeMatch.settings.rebowlWideLastBallOfOver || activeMatch.settings.rebowlWideAllInLastOver) ? "Cannot be enabled with specific over rules" : ""}>Re-bowl Wides</label>
                                            <input type="checkbox" id="rebowlWide" name="rebowlWide" checked={activeMatch.settings.rebowlWide ?? true} onChange={handleSettingsChange} disabled={activeMatch.settings.rebowlWideLastBallOfOver || activeMatch.settings.rebowlWideAllInLastOver} className="h-5 w-5 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="rebowlWideLastBallOfOver" className="text-sm text-text-primary cursor-pointer" title="Re-bowl only the last ball of an over if it is wide">Last ball only</label>
                                            <input type="checkbox" id="rebowlWideLastBallOfOver" name="rebowlWideLastBallOfOver" checked={activeMatch.settings.rebowlWideLastBallOfOver ?? false} onChange={handleSettingsChange} className="h-5 w-5 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="rebowlWideAllInLastOver" className="text-sm text-text-primary cursor-pointer" title="Re-bowl every wide ball in the final over. Runs for extras will be 1 in this over.">Final over</label>
                                            <input type="checkbox" id="rebowlWideAllInLastOver" name="rebowlWideAllInLastOver" checked={activeMatch.settings.rebowlWideAllInLastOver ?? false} onChange={handleSettingsChange} className="h-5 w-5 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className="font-semibold text-sm text-text-secondary mb-2">No Ball Re-bowl Rules</h4>
                                    <div className="space-y-2 bg-pitch-dark p-3 rounded-md">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="rebowlNoBall" className={`text-sm text-text-primary ${(activeMatch.settings.rebowlNoBallLastBallOfOver || activeMatch.settings.rebowlNoBallAllInLastOver) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={(activeMatch.settings.rebowlNoBallLastBallOfOver || activeMatch.settings.rebowlNoBallAllInLastOver) ? "Cannot be enabled with specific over rules" : ""}>Re-bowl No Balls</label>
                                            <input type="checkbox" id="rebowlNoBall" name="rebowlNoBall" checked={activeMatch.settings.rebowlNoBall ?? true} onChange={handleSettingsChange} disabled={activeMatch.settings.rebowlNoBallLastBallOfOver || activeMatch.settings.rebowlNoBallAllInLastOver} className="h-5 w-5 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="rebowlNoBallLastBallOfOver" className="text-sm text-text-primary cursor-pointer" title="Re-bowl only the last ball of an over if it is a no ball">Last ball only</label>
                                            <input type="checkbox" id="rebowlNoBallLastBallOfOver" name="rebowlNoBallLastBallOfOver" checked={activeMatch.settings.rebowlNoBallLastBallOfOver ?? false} onChange={handleSettingsChange} className="h-5 w-5 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="rebowlNoBallAllInLastOver" className="text-sm text-text-primary cursor-pointer" title="Re-bowl every no ball in the final over. Runs for extras will be 1 in this over.">Final over</label>
                                            <input type="checkbox" id="rebowlNoBallAllInLastOver" name="rebowlNoBallAllInLastOver" checked={activeMatch.settings.rebowlNoBallAllInLastOver ?? false} onChange={handleSettingsChange} className="h-5 w-5 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-light-gray !my-3"></div>
                            <div className="flex justify-between items-center">
                                <label htmlFor="wideRuns" className="text-text-primary">Wide Runs</label>
                                <div>
                                    <Input type="number" id="wideRuns" name="wideRuns" value={activeMatch.settings.wideRuns ?? 2} onChange={handleSettingsChange} min="0" className="text-center !py-1 !px-2" />
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <label htmlFor="noBallRuns" className="text-text-primary">No Ball Runs</label>
                                <div>
                                    <Input type="number" id="noBallRuns" name="noBallRuns" value={activeMatch.settings.noBallRuns ?? 2} onChange={handleSettingsChange} min="0" className="text-center !py-1 !px-2" />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            <ExtrasModal 
                isOpen={isExtrasModalOpen}
                onClose={() => setIsExtrasModalOpen(false)}
                onRecord={(extraType, runs, runsOffBat) => handleRecordDelivery({type: 'EXTRA', extraType, runs, runsOffBat})}
            />
            <WicketModal 
                isOpen={isWicketModalOpen}
                onClose={() => setIsWicketModalOpen(false)}
                onRecord={(dismissalType, dismissedPlayerId, nextBatsmanId, runs, assistingPlayerId, secondAssistingPlayerId) => handleRecordDelivery({type: 'WICKET', dismissalType, dismissedPlayerId, nextBatsmanId, runs, assistingPlayerId, secondAssistingPlayerId})}
                currentInning={currentInning}
                players={players}
                bowlingTeamPlayers={bowlingTeamPlayers}
            />
            {bowlingTeam && (
                <SelectBowlerModal 
                    isOpen={isAwaitingNextBowler}
                    onSelect={handleSelectBowler}
                    currentInning={currentInning}
                    bowlingTeam={bowlingTeam}
                    players={players}
                />
            )}
            <ScorecardModal
                isOpen={isScorecardModalOpen}
                onClose={() => setIsScorecardModalOpen(false)}
                match={activeMatch}
                teams={teams}
                players={players}
            />
            <RetireBatsmanModal
                isOpen={isRetireModalOpen}
                onClose={() => setIsRetireModalOpen(false)}
                onConfirm={handleRetireBatsman}
                currentInning={currentInning}
                players={players}
            />
            <Modal isOpen={isDeclareModalOpen} onClose={() => setIsDeclareModalOpen(false)} title="Confirm Innings Declaration">
                <div className="text-center">
                    <p className="mb-4">Are you sure you want to declare the current innings?</p>
                    <div className="flex justify-center space-x-4">
                        <Button variant="secondary" onClick={() => setIsDeclareModalOpen(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeclareInnings}>Confirm Declare</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const MAX_PLAYERS_PER_TEAM = 16;

const NewMatchModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { teams, players, createMatch, setActiveMatchId } = useApp();
    const [teamAId, setTeamAId] = useState('');
    const [teamBId, setTeamBId] = useState('');
    const [overs, setOvers] = useState(6);
    const [playersPerTeam, setPlayersPerTeam] = useState(8);
    const [tossWinner, setTossWinner] = useState('');
    const [decision, setDecision] = useState<'Bat' | 'Bowl'>('Bat');
    const [error, setError] = useState('');
    const [rebowlWide, setRebowlWide] = useState(false);
    const [rebowlNoBall, setRebowlNoBall] = useState(false);
    const [rebowlWideLastBallOfOver, setRebowlWideLastBallOfOver] = useState(false);
    const [rebowlNoBallLastBallOfOver, setRebowlNoBallLastBallOfOver] = useState(false);
    const [rebowlWideAllInLastOver, setRebowlWideAllInLastOver] = useState(true);
    const [rebowlNoBallAllInLastOver, setRebowlNoBallAllInLastOver] = useState(true);
    const [wideRuns, setWideRuns] = useState(2);
    const [noBallRuns, setNoBallRuns] = useState(2);
    const [selectedTeamAPlayers, setSelectedTeamAPlayers] = useState<string[]>([]);
    const [selectedTeamBPlayers, setSelectedTeamBPlayers] = useState<string[]>([]);

    const handleWideRuleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        switch(name) {
            case 'rebowlWide':
                setRebowlWide(checked);
                if (checked) {
                    setRebowlWideLastBallOfOver(false);
                    setRebowlWideAllInLastOver(false);
                }
                break;
            case 'rebowlWideLastBallOfOver':
                setRebowlWideLastBallOfOver(checked);
                if (checked) setRebowlWide(false);
                break;
            case 'rebowlWideAllInLastOver':
                setRebowlWideAllInLastOver(checked);
                if (checked) setRebowlWide(false);
                break;
        }
    };
    
    const handleNoBallRuleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        switch(name) {
            case 'rebowlNoBall':
                setRebowlNoBall(checked);
                if (checked) {
                    setRebowlNoBallLastBallOfOver(false);
                    setRebowlNoBallAllInLastOver(false);
                }
                break;
            case 'rebowlNoBallLastBallOfOver':
                setRebowlNoBallLastBallOfOver(checked);
                if (checked) setRebowlNoBall(false);
                break;
            case 'rebowlNoBallAllInLastOver':
                setRebowlNoBallAllInLastOver(checked);
                if (checked) setRebowlNoBall(false);
                break;
        }
    };

    useEffect(() => {
        if (isOpen && teams.length > 1) {
            setTeamAId(teams[0].id);
            setTeamBId(teams[1].id);
        }
    }, [teams, isOpen]);

    useEffect(() => {
        if (teamAId) {
            setTossWinner(teamAId);
            const team = teams.find(t => t.id === teamAId);
            const teamPlayers = team?.playerIds.map(pId => players.find(p => p.id === pId)).filter(Boolean) as Player[];
            setSelectedTeamAPlayers(teamPlayers ? teamPlayers.slice(0, playersPerTeam).map(p => p.id) : []);
        } else {
            setSelectedTeamAPlayers([]);
        }
    }, [teamAId, playersPerTeam, teams, players]);

    useEffect(() => {
        if (teamBId) {
            const team = teams.find(t => t.id === teamBId);
            const teamPlayers = team?.playerIds.map(pId => players.find(p => p.id === pId)).filter(Boolean) as Player[];
            setSelectedTeamBPlayers(teamPlayers ? teamPlayers.slice(0, playersPerTeam).map(p => p.id) : []);
        } else {
            setSelectedTeamBPlayers([]);
        }
    }, [teamBId, playersPerTeam, teams, players]);

    const teamA = teams.find(t => t.id === teamAId);
    const teamB = teams.find(t => t.id === teamBId);

    const teamAPlayersList = teamA?.playerIds.map(pId => players.find(p => p.id === pId)).filter(Boolean) as Player[] || [];
    const teamBPlayersList = teamB?.playerIds.map(pId => players.find(p => p.id === pId)).filter(Boolean) as Player[] || [];

    const handlePlayerToggle = (playerId: string, selectedPlayers: string[], setSelectedPlayers: React.Dispatch<React.SetStateAction<string[]>>) => {
        const isSelected = selectedPlayers.includes(playerId);
        if (isSelected) {
            setSelectedPlayers(prev => prev.filter(id => id !== playerId));
        } else if (selectedPlayers.length < playersPerTeam) {
            setSelectedPlayers(prev => [...prev, playerId]);
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!teamAId || !teamBId || teamAId === teamBId) {
            setError("Please select two different teams.");
            return;
        }

        if (teamAPlayersList.length < playersPerTeam || teamBPlayersList.length < playersPerTeam) {
            setError(`Both teams must have at least ${playersPerTeam} players available to form a squad.`);
            return;
        }
        
        if (selectedTeamAPlayers.length !== playersPerTeam || selectedTeamBPlayers.length !== playersPerTeam) {
            setError(`Please select exactly ${playersPerTeam} players for each team.`);
            return;
        }

        const settings: MatchSettings = {
            overs,
            playersPerTeam,
            tossWinnerTeamId: tossWinner,
            decision,
            rebowlWide,
            rebowlNoBall,
            wideRuns,
            noBallRuns,
            rebowlWideLastBallOfOver,
            rebowlNoBallLastBallOfOver,
            rebowlWideAllInLastOver,
            rebowlNoBallAllInLastOver,
        };
        
        try {
            const newMatchId = await createMatch(settings, teamAId, teamBId, selectedTeamAPlayers, selectedTeamBPlayers);
            setActiveMatchId(newMatchId);
            onClose();
        } catch (err) {
            setError("Failed to create match.");
            console.error(err);
        }
    };
    
    const teamBOptions = teams.filter(t => t.id !== teamAId);

    const PlayerSelectionList: React.FC<{
        players: Player[],
        selectedPlayers: string[],
        onToggle: (playerId: string) => void,
        max: number
    }> = ({ players, selectedPlayers, onToggle, max }) => (
        <div className="max-h-56 overflow-y-auto border border-light-gray rounded-md p-3 space-y-2 bg-pitch-dark">
            {players.length > 0 ? players.map(player => {
                const isSelected = selectedPlayers.includes(player.id);
                const isAtMax = selectedPlayers.length >= max;
                const isDisabled = isAtMax && !isSelected;
                return (
                    <div key={player.id} className={`flex items-center space-x-3 p-1 rounded ${isDisabled ? 'opacity-50' : ''}`}>
                        <input
                            type="checkbox"
                            id={`player-select-${player.id}`}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => onToggle(player.id)}
                            className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer disabled:cursor-not-allowed"
                        />
                        <label htmlFor={`player-select-${player.id}`} className={`flex-grow text-sm ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            {player.name}
                        </label>
                    </div>
                );
            }) : <p className="text-sm text-text-secondary text-center">Select a team to see players.</p>}
        </div>
    );

    const topAPlayersIds = teamAPlayersList.slice(0, playersPerTeam).map(p => p.id);
    const areTopAPlayersSelected = selectedTeamAPlayers.length === topAPlayersIds.length && 
                           selectedTeamAPlayers.every(id => topAPlayersIds.includes(id)) &&
                           topAPlayersIds.every(id => selectedTeamAPlayers.includes(id));
    
    const topBPlayersIds = teamBPlayersList.slice(0, playersPerTeam).map(p => p.id);
    const areTopBPlayersSelected = selectedTeamBPlayers.length === topBPlayersIds.length && 
                           selectedTeamBPlayers.every(id => topBPlayersIds.includes(id)) &&
                           topBPlayersIds.every(id => selectedTeamBPlayers.includes(id));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Start New Match" size="3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Team A" value={teamAId} onChange={e => setTeamAId(e.target.value)}>
                        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </Select>
                    <Select label="Team B" value={teamBId} onChange={e => setTeamBId(e.target.value)}>
                        {teamBOptions.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Overs" type="number" value={overs} onChange={e => setOvers(parseInt(e.target.value, 10))} min="1" max="50" />
                    <Input label="Players per Team" type="number" value={playersPerTeam} onChange={e => setPlayersPerTeam(parseInt(e.target.value, 10))} min="2" max={MAX_PLAYERS_PER_TEAM} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Select label="Toss Won By" value={tossWinner} onChange={e => setTossWinner(e.target.value)}>
                         {teamAId && <option value={teamAId}>{teamA?.name}</option>}
                         {teamBId && <option value={teamBId}>{teamB?.name}</option>}
                     </Select>
                     <Select label="Decision" value={decision} onChange={e => setDecision(e.target.value as 'Bat' | 'Bowl')}>
                         <option value="Bat">Bat</option>
                         <option value="Bowl">Bowl</option>
                     </Select>
                 </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-light-gray pt-4">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-text-secondary">
                                {teamA?.name || 'Team A'} Squad ({selectedTeamAPlayers.length}/{playersPerTeam})
                            </h4>
                             <Button
                                type="button" variant="ghost" size="sm"
                                onClick={() => {
                                    if (areTopAPlayersSelected) {
                                        setSelectedTeamAPlayers([]);
                                    } else {
                                        setSelectedTeamAPlayers(topAPlayersIds);
                                    }
                                }}
                                disabled={teamAPlayersList.length === 0}
                            >
                                {areTopAPlayersSelected ? 'Deselect All' : `Auto-select`}
                            </Button>
                        </div>
                        <PlayerSelectionList players={teamAPlayersList} selectedPlayers={selectedTeamAPlayers} onToggle={(pId) => handlePlayerToggle(pId, selectedTeamAPlayers, setSelectedTeamAPlayers)} max={playersPerTeam}/>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-text-secondary">
                                {teamB?.name || 'Team B'} Squad ({selectedTeamBPlayers.length}/{playersPerTeam})
                            </h4>
                            <Button
                                type="button" variant="ghost" size="sm"
                                onClick={() => {
                                    if (areTopBPlayersSelected) {
                                        setSelectedTeamBPlayers([]);
                                    } else {
                                        setSelectedTeamBPlayers(topBPlayersIds);
                                    }
                                }}
                                disabled={teamBPlayersList.length === 0}
                            >
                                {areTopBPlayersSelected ? 'Deselect All' : `Auto-select`}
                            </Button>
                        </div>
                        <PlayerSelectionList players={teamBPlayersList} selectedPlayers={selectedTeamBPlayers} onToggle={(pId) => handlePlayerToggle(pId, selectedTeamBPlayers, setSelectedTeamBPlayers)} max={playersPerTeam}/>
                    </div>
                </div>

                 <div className="border-t border-light-gray my-4"></div>
                 <h4 className="font-semibold text-text-secondary">Extra Rules</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Wide Runs" type="number" value={wideRuns} onChange={e => setWideRuns(parseInt(e.target.value) || 0)} min="0" />
                    <Input label="No Ball Runs" type="number" value={noBallRuns} onChange={e => setNoBallRuns(parseInt(e.target.value) || 0)} min="0" />
                </div>
                <div className="space-y-4 mt-2">
                    <div>
                        <h5 className="font-semibold text-sm text-text-secondary mb-2">Wide Re-bowl Rules</h5>
                        <div className="space-y-2 bg-pitch-dark p-3 rounded-md">
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="rebowlWideModal" name="rebowlWide" checked={rebowlWide} onChange={handleWideRuleChange} disabled={rebowlWideLastBallOfOver || rebowlWideAllInLastOver} className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="rebowlWideModal" className={`text-sm ${(rebowlWideLastBallOfOver || rebowlWideAllInLastOver) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={(rebowlWideLastBallOfOver || rebowlWideAllInLastOver) ? "Cannot be enabled with specific over rules" : ""}>Re-bowl Wides</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="rebowlWideLastBallOfOverModal" name="rebowlWideLastBallOfOver" checked={rebowlWideLastBallOfOver} onChange={handleWideRuleChange} className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                <label htmlFor="rebowlWideLastBallOfOverModal" className="text-sm cursor-pointer" title="Re-bowl only the last ball of an over if it is wide">Re-bowl last ball only</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="rebowlWideAllInLastOverModal" name="rebowlWideAllInLastOver" checked={rebowlWideAllInLastOver} onChange={handleWideRuleChange} className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                <label htmlFor="rebowlWideAllInLastOverModal" className="text-sm cursor-pointer" title="Re-bowl every wide ball in the final over. Runs for extras will be 1 in this over.">Final over</label>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h5 className="font-semibold text-sm text-text-secondary mb-2">No Ball Re-bowl Rules</h5>
                        <div className="space-y-2 bg-pitch-dark p-3 rounded-md">
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="rebowlNoBallModal" name="rebowlNoBall" checked={rebowlNoBall} onChange={handleNoBallRuleChange} disabled={rebowlNoBallLastBallOfOver || rebowlNoBallAllInLastOver} className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="rebowlNoBallModal" className={`text-sm ${(rebowlNoBallLastBallOfOver || rebowlNoBallAllInLastOver) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={(rebowlNoBallLastBallOfOver || rebowlNoBallAllInLastOver) ? "Cannot be enabled with specific over rules" : ""}>Re-bowl No Balls</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="rebowlNoBallLastBallOfOverModal" name="rebowlNoBallLastBallOfOver" checked={rebowlNoBallLastBallOfOver} onChange={handleNoBallRuleChange} className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                <label htmlFor="rebowlNoBallLastBallOfOverModal" className="text-sm cursor-pointer" title="Re-bowl only the last ball of an over if it is a no ball">Re-bowl last ball only</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="rebowlNoBallAllInLastOverModal" name="rebowlNoBallAllInLastOver" checked={rebowlNoBallAllInLastOver} onChange={handleNoBallRuleChange} className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer" />
                                <label htmlFor="rebowlNoBallAllInLastOverModal" className="text-sm cursor-pointer" title="Re-bowl every no ball in the final over. Runs for extras will be 1 in this over.">Final over</label>
                            </div>
                        </div>
                    </div>
                </div>


                 {error && <p className="text-red-500 text-sm text-center pt-2">{error}</p>}
                 <div className="flex justify-end pt-4">
                     <Button type="submit">Start Match</Button>
                 </div>
            </form>
        </Modal>
    );
};


const ImportFromSheetModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { importFromGoogleSheet } = useApp();
    const [sheetUrl, setSheetUrl] = useState('');
    const [sheetName, setSheetName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const resetState = () => {
        setSheetUrl('');
        setSheetName('');
        setIsLoading(false);
        setError('');
        setSuccess('');
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetState, 300); // Reset after modal fade out
    };
    
    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sheetUrl || !sheetName) {
            setError("Please provide both the Google Sheet URL and the Sheet Name.");
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await importFromGoogleSheet(sheetUrl, sheetName);
            setSuccess("Successfully imported players and teams!");
            setTimeout(handleClose, 2000);
        } catch (err: any) {
            setError(err.message || "An unknown error occurred during import.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Import from Google Sheet">
            <form onSubmit={handleImport} className="space-y-4">
                <Input
                    label="Google Sheet URL"
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    required
                    disabled={isLoading}
                />
                <Input
                    label="Sheet Name"
                    value={sheetName}
                    onChange={e => setSheetName(e.target.value)}
                    placeholder="e.g., Sheet1 or Players"
                    required
                    disabled={isLoading}
                />

                <Card className="bg-light-gray !p-3">
                    <p className="text-sm text-text-secondary">
                        <strong>Important:</strong> Your sheet must be public ("Anyone with the link can view").
                    </p>
                    <p className="text-sm text-text-secondary mt-2">
                        The sheet needs a header row with columns named `player` and `team`. You can also include an optional `role` column (e.g., Batsman, Bowler).
                    </p>
                </Card>

                {error && <p className="text-red-500 text-sm">{error}</p>}
                {success && <p className="text-green-500 text-sm">{success}</p>}

                <div className="flex justify-end space-x-2 pt-2">
                    <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Importing...' : 'Import Data'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const ImportMatchModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { importMatchData } = useApp();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setIsLoading(false);
        setError('');
        setSuccess('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetState, 300);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const matchJson = await file.text();
            await importMatchData(matchJson);
            setSuccess("Match imported successfully!");
            setTimeout(handleClose, 2000);
        } catch (err: any) {
            setError(err.message || "An unknown error occurred during import.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Import Match Data">
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                    Select a previously exported match JSON file to import it into the scorer. If a match with the same ID exists, it will be overwritten.
                </p>
                <Input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    disabled={isLoading}
                    aria-label="Match data file input"
                />

                {isLoading && <p className="text-accent-blue text-sm" role="status">Importing...</p>}
                {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
                {success && <p className="text-green-500 text-sm" role="status">{success}</p>}
                
                <div className="flex justify-end pt-2">
                    <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const BackupRestoreModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const { backupAllData, restoreAllData } = useApp();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setIsLoading(false);
        setError('');
        setSuccess('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetState, 300);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const fileContent = await file.text();
            await restoreAllData(fileContent);
            setSuccess("Data restored successfully! New players, teams, and matches have been added.");
        } catch (err: any) {
            setError(err.message || "An unknown error occurred during restore.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackup = () => {
        backupAllData();
        setSuccess("Backup file download started.");
        setTimeout(() => setSuccess(''), 3000);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Backup & Restore">
            <div className="space-y-6">
                <Card className="bg-pitch-dark">
                    <h3 className="font-semibold text-lg mb-2">Backup All Data</h3>
                    <p className="text-sm text-text-secondary mb-4">
                        Download a single JSON file containing all your players, teams, and matches. Keep this file in a safe place.
                    </p>
                    <Button onClick={handleBackup} className="w-full">
                        Download Backup
                    </Button>
                </Card>
                <Card className="bg-pitch-dark">
                    <h3 className="font-semibold text-lg mb-2">Restore from Backup</h3>
                    <p className="text-sm text-text-secondary mb-4">
                        Upload a backup file to restore your data. This is a non-destructive process; it will only add new players, teams, and matches, and will not overwrite any of your existing data.
                    </p>
                    <Input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        disabled={isLoading}
                        aria-label="Backup file input"
                    />
                </Card>

                {isLoading && <p className="text-accent-blue text-sm text-center" role="status">Restoring data...</p>}
                {error && <p className="text-red-500 text-sm text-center" role="alert">{error}</p>}
                {success && <p className="text-green-500 text-sm text-center" role="status">{success}</p>}
                
                <div className="flex justify-end pt-2">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const DashboardPage: React.FC = () => {
    const { matches, teams, setActiveMatchId, deleteMatch } = useApp();
    const [isNewMatchModalOpen, setIsNewMatchModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportMatchModalOpen, setIsImportMatchModalOpen] = useState(false);
    const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);

    const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || 'Unknown Team';

    const handleConfirmDelete = async () => {
        if (matchToDelete) {
            await deleteMatch(matchToDelete.id);
            setMatchToDelete(null);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6 gap-y-4">
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => setIsBackupRestoreModalOpen(true)} variant="secondary" className="flex items-center space-x-2">
                        <DatabaseIcon className="w-5 h-5" />
                        <span>Backup/Restore</span>
                    </Button>
                    <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" className="flex items-center space-x-2">
                        <CloudUploadIcon className="w-5 h-5" />
                        <span>Import Sheet</span>
                    </Button>
                    <Button onClick={() => setIsImportMatchModalOpen(true)} variant="secondary" className="flex items-center space-x-2">
                        <CloudUploadIcon className="w-5 h-5" />
                        <span>Import Match</span>
                    </Button>
                    <Button onClick={() => setIsNewMatchModalOpen(true)} className="flex items-center space-x-2">
                        <PlusIcon className="w-5 h-5" />
                        <span>New Match</span>
                    </Button>
                </div>
            </div>

            <h3 className="text-xl font-semibold mb-4 text-text-secondary">Recent Matches</h3>
            {matches.length === 0 ? (
                <Card className="text-center py-12">
                    <p className="text-text-secondary">No matches played yet.</p>
                    <p className="text-text-secondary">Click 'New Match' to get started!</p>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {matches.map(match => {
                        const teamA = getTeamName(match.teamAId);
                        const teamB = getTeamName(match.teamBId);
                        return (
                            <Card key={match.id} className="cursor-pointer hover:border-cricket-green transition-colors" onClick={() => setActiveMatchId(match.id)}>
                                <div className="flex justify-between items-start mb-2 gap-2">
                                    <h4 className="font-bold text-lg flex-grow">{teamA} vs {teamB}</h4>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`px-2 py-1 text-xs rounded-full ${match.status === 'Finished' ? 'bg-cricket-green' : 'bg-yellow-500'} text-white`}>
                                            {match.status}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="p-1 h-auto -mr-2 -mt-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMatchToDelete(match);
                                            }}
                                            aria-label={`Delete match between ${teamA} and ${teamB}`}
                                        >
                                            <Trash2Icon className="w-5 h-5 text-red-500 hover:text-red-400" />
                                        </Button>
                                    </div>
                                </div>
                                {match.status === 'Finished' ? (
                                    <p className="text-text-secondary">{match.resultText}</p>
                                ) : (
                                    <p className="text-text-secondary">{match.settings.overs} over match</p>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
            
            <NewMatchModal isOpen={isNewMatchModalOpen} onClose={() => setIsNewMatchModalOpen(false)} />
            <ImportFromSheetModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
            <ImportMatchModal isOpen={isImportMatchModalOpen} onClose={() => setIsImportMatchModalOpen(false)} />
            <BackupRestoreModal isOpen={isBackupRestoreModalOpen} onClose={() => setIsBackupRestoreModalOpen(false)} />
            <Modal isOpen={!!matchToDelete} onClose={() => setMatchToDelete(null)} title="Confirm Match Deletion">
                {matchToDelete && (
                    <div className="text-center">
                        <p className="mb-4">Are you sure you want to delete the match between <strong>{getTeamName(matchToDelete.teamAId)}</strong> and <strong>{getTeamName(matchToDelete.teamBId)}</strong>? This action cannot be undone.</p>
                        <div className="flex justify-center space-x-4">
                            <Button variant="secondary" onClick={() => setMatchToDelete(null)}>Cancel</Button>
                            <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const StatsPage: React.FC = () => {
    const { matches, players } = useApp();
    const [activeTab, setActiveTab] = useState<'batting' | 'bowling' | 'fielding'>('batting');
    
    type SortDirection = 'ascending' | 'descending';
    interface SortConfig {
        key: string;
        direction: SortDirection;
    }
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'batting.runs', direction: 'descending' });

    const playerStats = useMemo(() => {
        const stats: Record<string, {
            batting: { matches: number; innings: number; runs: number; balls: number; notOuts: number; highestScore: number; fours: number; sixes: number; fifties: number; hundreds: number; };
            bowling: { matches: number; innings: number; balls: number; runsConceded: number; wickets: number; maidens: number; bestBowling: { wickets: number; runs: number; }; };
            fielding: { catches: number; stumpings: number; runOuts: number; };
        }> = {};

        players.forEach(p => {
            stats[p.id] = {
                batting: { matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0, highestScore: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0 },
                bowling: { matches: 0, innings: 0, balls: 0, runsConceded: 0, wickets: 0, maidens: 0, bestBowling: { wickets: 0, runs: 999 } },
                fielding: { catches: 0, stumpings: 0, runOuts: 0 }
            };
        });

        const finishedMatches = matches.filter(m => m.status === 'Finished');

        finishedMatches.forEach(match => {
            const playersInMatch = new Set([...match.teamAPlayers, ...match.teamBPlayers]);
            const battingInningsCount: Record<string, number> = {};
            const bowlingInningsCount: Record<string, number> = {};

            [match.inning1, match.inning2].forEach(inning => {
                if (!inning) return;
                
                Object.keys(inning.batsmanStats).forEach((pId) => {
                    const pStats = inning.batsmanStats[pId];
                    if (stats[pId] && (pStats.balls > 0 || pStats.isOut)) {
                        battingInningsCount[pId] = (battingInningsCount[pId] || 0) + 1;
                        stats[pId].batting.runs += pStats.runs;
                        stats[pId].batting.balls += pStats.balls;
                        if (!pStats.isOut && pStats.balls > 0) stats[pId].batting.notOuts++;
                        if (pStats.runs > stats[pId].batting.highestScore) stats[pId].batting.highestScore = pStats.runs;
                        if (pStats.runs >= 100) stats[pId].batting.hundreds++;
                        else if (pStats.runs >= 50) stats[pId].batting.fifties++;
                        stats[pId].batting.fours += pStats.fours;
                        stats[pId].batting.sixes += pStats.sixes;
                    }
                });
                
                Object.keys(inning.bowlerStats).forEach((pId) => {
                    const pStats = inning.bowlerStats[pId];
                    if (stats[pId] && (pStats.balls > 0 || pStats.overs > 0)) {
                        bowlingInningsCount[pId] = (bowlingInningsCount[pId] || 0) + 1;
                        stats[pId].bowling.balls += pStats.overs * 6 + pStats.balls;
                        stats[pId].bowling.runsConceded += pStats.runsConceded;
                        stats[pId].bowling.wickets += pStats.wickets;
                        stats[pId].bowling.maidens += pStats.maidens;
                        
                        const currentBest = stats[pId].bowling.bestBowling;
                        if (pStats.wickets > currentBest.wickets || (pStats.wickets === currentBest.wickets && pStats.runsConceded < currentBest.runs)) {
                            stats[pId].bowling.bestBowling = { wickets: pStats.wickets, runs: pStats.runsConceded };
                        }
                    }
                });

                inning.timeline.forEach(ball => {
                    if (ball.wicket) {
                        const { type, assistingPlayerId, secondAssistingPlayerId } = ball.wicket;
                        if (assistingPlayerId && stats[assistingPlayerId]) {
                            if (type === 'Caught') stats[assistingPlayerId].fielding.catches++;
                            if (type === 'Stumped') stats[assistingPlayerId].fielding.stumpings++;
                            if (type === 'Run Out') stats[assistingPlayerId].fielding.runOuts++;
                        }
                        if (secondAssistingPlayerId && stats[secondAssistingPlayerId] && type === 'Run Out') {
                            stats[secondAssistingPlayerId].fielding.runOuts++;
                        }
                    }
                });
            });
            
            playersInMatch.forEach(pId => {
                if (battingInningsCount[pId]) {
                    stats[pId].batting.matches++;
                    stats[pId].batting.innings += battingInningsCount[pId];
                }
                if (bowlingInningsCount[pId]) {
                    stats[pId].bowling.matches++;
                    stats[pId].bowling.innings += bowlingInningsCount[pId];
                }
            });
        });

        return players.map(p => {
            const batStats = stats[p.id].batting;
            const bowlStats = stats[p.id].bowling;
            const outs = batStats.innings - batStats.notOuts;
            return {
                player: p,
                batting: {
                    ...batStats,
                    average: outs > 0 ? (batStats.runs / outs).toFixed(2) : '0.00',
                    strikeRate: batStats.balls > 0 ? (batStats.runs / batStats.balls * 100).toFixed(2) : '0.00',
                },
                bowling: {
                    ...bowlStats,
                    overs: `${Math.floor(bowlStats.balls / 6)}.${bowlStats.balls % 6}`,
                    economy: bowlStats.balls > 0 ? (bowlStats.runsConceded / bowlStats.balls * 6).toFixed(2) : '0.00',
                    average: bowlStats.wickets > 0 ? (bowlStats.runsConceded / bowlStats.wickets).toFixed(2) : '0.00',
                    strikeRate: bowlStats.wickets > 0 ? (bowlStats.balls / bowlStats.wickets).toFixed(2) : '0.00',
                },
                fielding: stats[p.id].fielding
            }
        }).filter(p => p.batting.innings > 0 || p.bowling.innings > 0 || p.fielding.catches > 0 || p.fielding.stumpings > 0 || p.fielding.runOuts > 0);
    }, [matches, players]);
    
    const sortedPlayerStats = useMemo(() => {
        let sortableItems = [...playerStats];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                const keys = sortConfig.key.split('.');
                const getValue = (obj: any, path: string[]) => path.reduce((acc, part) => acc && acc[part], obj);

                let aValue = getValue(a, keys);
                let bValue = getValue(b, keys);

                if (sortConfig.key === 'bowling.bestBowling') {
                    const aBBI = a.bowling.bestBowling;
                    const bBBI = b.bowling.bestBowling;
                    if (aBBI.wickets !== bBBI.wickets) {
                        return bBBI.wickets - aBBI.wickets; 
                    }
                    return aBBI.runs - bBBI.runs;
                }
                
                if (typeof aValue === 'string' && !isNaN(parseFloat(aValue)) && keys[keys.length - 1] !== 'overs') {
                    aValue = parseFloat(aValue);
                    bValue = parseFloat(bValue);
                }

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [playerStats, sortConfig]);

    // FIX: Explicitly typing the new sort direction prevents a potential TypeScript error where the ternary operator's result is inferred as `string` instead of the specific `SortDirection` union type.
    const requestSort = (key: string, defaultDirection: SortDirection = 'descending') => {
        if (sortConfig.key === key) {
            // If it's the same key, toggle the direction
            const newDirection: SortDirection = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
            setSortConfig({
                key,
                direction: newDirection,
            });
        } else {
            // If it's a new key, set it with the default direction
            setSortConfig({
                key,
                direction: defaultDirection,
            });
        }
    };
    
    const ThSortable: React.FC<{ sortKey: string; children: React.ReactNode; defaultDir?: SortDirection; className?: string; }> = ({ sortKey, children, defaultDir = 'descending', className = '' }) => {
        const isSorted = sortConfig.key === sortKey;
        const icon = isSorted 
            ? (sortConfig.direction === 'ascending' ? <ChevronUpIcon className="w-4 h-4 ml-1 flex-shrink-0" /> : <ChevronDownIcon className="w-4 h-4 ml-1 flex-shrink-0" />)
            : <div className="w-4 h-4 ml-1"></div>;

        return (
            <th className={`p-3 font-semibold cursor-pointer select-none ${className}`} onClick={() => requestSort(sortKey, defaultDir)}>
                <div className="flex items-center">{children}{icon}</div>
            </th>
        );
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Player Statistics</h2>
        </div>
        <div className="mb-4 border-b border-light-gray">
            <nav className="flex space-x-1 sm:space-x-4">
                <button onClick={() => { setActiveTab('batting'); setSortConfig({ key: 'batting.runs', direction: 'descending' }); }} className={`py-2 px-3 sm:px-4 text-sm font-medium ${activeTab === 'batting' ? 'border-b-2 border-cricket-green text-text-primary' : 'text-text-secondary'}`}>Batting</button>
                <button onClick={() => { setActiveTab('bowling'); setSortConfig({ key: 'bowling.wickets', direction: 'descending' }); }} className={`py-2 px-3 sm:px-4 text-sm font-medium ${activeTab === 'bowling' ? 'border-b-2 border-cricket-green text-text-primary' : 'text-text-secondary'}`}>Bowling</button>
                <button onClick={() => { setActiveTab('fielding'); setSortConfig({ key: 'fielding.catches', direction: 'descending' }); }} className={`py-2 px-3 sm:px-4 text-sm font-medium ${activeTab === 'fielding' ? 'border-b-2 border-cricket-green text-text-primary' : 'text-text-secondary'}`}>Fielding</button>
            </nav>
        </div>
        
        {activeTab === 'batting' && (
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-light-gray">
                            <tr>
                                <ThSortable sortKey="player.name" defaultDir='ascending'>Player</ThSortable>
                                <ThSortable sortKey="batting.matches">Mat</ThSortable>
                                <ThSortable sortKey="batting.innings">Inns</ThSortable>
                                <ThSortable sortKey="batting.runs">Runs</ThSortable>
                                <ThSortable sortKey="batting.average">Avg</ThSortable>
                                <ThSortable sortKey="batting.highestScore">HS</ThSortable>
                                <ThSortable sortKey="batting.balls">BF</ThSortable>
                                <ThSortable sortKey="batting.strikeRate">SR</ThSortable>
                                <ThSortable sortKey="batting.hundreds">100</ThSortable>
                                <ThSortable sortKey="batting.fifties">50</ThSortable>
                                <ThSortable sortKey="batting.fours">4s</ThSortable>
                                <ThSortable sortKey="batting.sixes">6s</ThSortable>
                                <ThSortable sortKey="batting.notOuts">NO</ThSortable>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayerStats.filter(p=>p.batting.innings > 0).map(({player, batting}) => (
                                <tr key={player.id} className="border-b border-light-gray last:border-0 font-mono">
                                    <td className="p-3 font-sans font-semibold whitespace-nowrap">{player.name}</td>
                                    <td className="p-3">{batting.matches}</td>
                                    <td className="p-3">{batting.innings}</td>
                                    <td className="p-3 font-bold">{batting.runs}</td>
                                    <td className="p-3">{batting.average}</td>
                                    <td className="p-3">{batting.highestScore}</td>
                                    <td className="p-3">{batting.balls}</td>
                                    <td className="p-3">{batting.strikeRate}</td>
                                    <td className="p-3">{batting.hundreds}</td>
                                    <td className="p-3">{batting.fifties}</td>
                                    <td className="p-3">{batting.fours}</td>
                                    <td className="p-3">{batting.sixes}</td>
                                    <td className="p-3">{batting.notOuts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        )}

        {activeTab === 'bowling' && (
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-light-gray">
                           <tr>
                                <ThSortable sortKey="player.name" defaultDir='ascending'>Player</ThSortable>
                                <ThSortable sortKey="bowling.matches">Mat</ThSortable>
                                <ThSortable sortKey="bowling.innings">Inns</ThSortable>
                                <ThSortable sortKey="bowling.overs">Overs</ThSortable>
                                <ThSortable sortKey="bowling.maidens">Mdns</ThSortable>
                                <ThSortable sortKey="bowling.runsConceded">Runs</ThSortable>
                                <ThSortable sortKey="bowling.wickets">Wkts</ThSortable>
                                <ThSortable sortKey="bowling.bestBowling">BBI</ThSortable>
                                <ThSortable sortKey="bowling.average" defaultDir='ascending'>Avg</ThSortable>
                                <ThSortable sortKey="bowling.economy" defaultDir='ascending'>Econ</ThSortable>
                                <ThSortable sortKey="bowling.strikeRate" defaultDir='ascending'>SR</ThSortable>
                            </tr>
                        </thead>
                         <tbody>
                            {sortedPlayerStats.filter(p=>p.bowling.innings > 0).map(({player, bowling}) => (
                                <tr key={player.id} className="border-b border-light-gray last:border-0 font-mono">
                                    <td className="p-3 font-sans font-semibold whitespace-nowrap">{player.name}</td>
                                    <td className="p-3">{bowling.matches}</td>
                                    <td className="p-3">{bowling.innings}</td>
                                    <td className="p-3">{bowling.overs}</td>
                                    <td className="p-3">{bowling.maidens}</td>
                                    <td className="p-3">{bowling.runsConceded}</td>
                                    <td className="p-3 font-bold">{bowling.wickets}</td>
                                    <td className="p-3">{bowling.bestBowling.wickets > 0 ? `${bowling.bestBowling.wickets}/${bowling.bestBowling.runs}` : '-'}</td>
                                    <td className="p-3">{bowling.average}</td>
                                    <td className="p-3">{bowling.economy}</td>
                                    <td className="p-3">{bowling.strikeRate}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        )}
        
        {activeTab === 'fielding' && (
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-light-gray">
                           <tr>
                                <ThSortable sortKey="player.name" defaultDir='ascending'>Player</ThSortable>
                                <ThSortable sortKey="fielding.catches">Catches</ThSortable>
                                <ThSortable sortKey="fielding.stumpings">Stumpings</ThSortable>
                                <ThSortable sortKey="fielding.runOuts">Run Outs</ThSortable>
                            </tr>
                        </thead>
                         <tbody>
                            {sortedPlayerStats.filter(p=>p.fielding.catches > 0 || p.fielding.stumpings > 0 || p.fielding.runOuts > 0).map(({player, fielding}) => (
                                <tr key={player.id} className="border-b border-light-gray last:border-0 font-mono">
                                    <td className="p-3 font-sans font-semibold whitespace-nowrap">{player.name}</td>
                                    <td className="p-3">{fielding.catches}</td>
                                    <td className="p-3">{fielding.stumpings}</td>
                                    <td className="p-3">{fielding.runOuts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        )}

      </div>
    );
};


const EditPlayerModal: React.FC<{
    player: Player | null;
    isOpen: boolean;
    onClose: () => void;
}> = ({ player, isOpen, onClose }) => {
    const { updatePlayer } = useApp();
    const [playerName, setPlayerName] = useState('');
    const [playerRole, setPlayerRole] = useState<Player['role']>('Batsman');

    useEffect(() => {
        if (player) {
            setPlayerName(player.name);
            setPlayerRole(player.role);
        }
    }, [player]);

    if (!player) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim()) {
            await updatePlayer({ ...player, name: playerName.trim(), role: playerRole });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${player.name}`}>
            <form onSubmit={handleSave} className="space-y-4">
                <Input label="Player Name" value={playerName} onChange={e => setPlayerName(e.target.value)} required />
                <Select label="Role" value={playerRole} onChange={e => setPlayerRole(e.target.value as any)}>
                    <option>Batsman</option>
                    <option>Bowler</option>
                    <option>All-Rounder</option>
                    <option>Wicket-Keeper</option>
                </Select>
                <div className="flex justify-end pt-2">
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Modal>
    );
};

const PlayersPage: React.FC = () => {
    const { players, addPlayer, deletePlayer } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerRole, setNewPlayerRole] = useState<'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'>('Batsman');
    const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);

    const handleAddPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlayerName.trim()) {
            await addPlayer({ name: newPlayerName.trim(), role: newPlayerRole });
            setNewPlayerName('');
            setNewPlayerRole('Batsman');
            setIsModalOpen(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (playerToDelete) {
            await deletePlayer(playerToDelete.id);
            setPlayerToDelete(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Players Management</h2>
                <Button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2">
                    <UserPlusIcon className="w-5 h-5" />
                    <span>Add Player</span>
                </Button>
            </div>
            <Card>
                <ul className="divide-y divide-light-gray">
                    {players.map(player => (
                        <li key={player.id} className="flex justify-between items-center py-3">
                            <div>
                                <p className="font-semibold">{player.name}</p>
                                <p className="text-sm text-text-secondary">{player.role}</p>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Button variant="ghost" size="sm" onClick={() => setEditingPlayer(player)}>
                                    <EditIcon className="w-5 h-5 text-accent-blue" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setPlayerToDelete(player)}>
                                    <Trash2Icon className="w-5 h-5 text-red-500" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </Card>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Player">
                <form onSubmit={handleAddPlayer} className="space-y-4">
                    <Input label="Player Name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} placeholder="e.g., Virat Kohli" required />
                    <Select label="Role" value={newPlayerRole} onChange={e => setNewPlayerRole(e.target.value as any)}>
                        <option>Batsman</option>
                        <option>Bowler</option>
                        <option>All-Rounder</option>
                        <option>Wicket-Keeper</option>
                    </Select>
                    <div className="flex justify-end pt-2">
                        <Button type="submit">Add Player</Button>
                    </div>
                </form>
            </Modal>
            <Modal isOpen={!!playerToDelete} onClose={() => setPlayerToDelete(null)} title="Confirm Deletion">
                {playerToDelete && (
                    <div className="text-center">
                        <p className="mb-4">Are you sure you want to delete {playerToDelete.name}? This will remove them from all associated teams.</p>
                        <div className="flex justify-center space-x-4">
                            <Button variant="secondary" onClick={() => setPlayerToDelete(null)}>Cancel</Button>
                            <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
                        </div>
                    </div>
                )}
            </Modal>
            <EditPlayerModal 
                player={editingPlayer}
                isOpen={!!editingPlayer}
                onClose={() => setEditingPlayer(null)}
            />
        </div>
    );
};

const EditTeamModal: React.FC<{
    team: Team | null;
    isOpen: boolean;
    onClose: () => void;
}> = ({ team, isOpen, onClose }) => {
    const { players, teams, updateTeam } = useApp();
    const [teamName, setTeamName] = useState('');
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (team) {
            setTeamName(team.name);
            setSelectedPlayerIds(team.playerIds);
            setError('');
        }
    }, [team]);

    if (!team) return null;

    const handlePlayerToggle = (playerId: string) => {
        setSelectedPlayerIds(prev => {
            if (prev.includes(playerId)) {
                return prev.filter(id => id !== playerId);
            }
            if (prev.length < MAX_PLAYERS_PER_TEAM) {
                return [...prev, playerId];
            }
            return prev;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (teamName.trim()) {
            try {
                await updateTeam({ ...team, name: teamName.trim(), playerIds: selectedPlayerIds });
                onClose();
            } catch (err: any) {
                setError(err.message);
            }
        }
    };

    const playersOnOtherTeams = teams
        .filter(t => t.id !== team.id)
        .flatMap(t => t.playerIds);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Team`} size="lg">
            <form onSubmit={handleSave} className="space-y-4">
                <Input
                    label="Team Name"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    required
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-text-secondary">
                            Select Players
                        </h4>
                        <span className="text-sm font-mono px-2 py-1 bg-light-gray rounded">
                            {selectedPlayerIds.length}/{MAX_PLAYERS_PER_TEAM}
                        </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto border border-light-gray rounded-md p-3 space-y-2">
                        {players.map(player => {
                            const isSelected = selectedPlayerIds.includes(player.id);
                            const isOnAnotherTeam = playersOnOtherTeams.includes(player.id);
                            const teamOfPlayer = isOnAnotherTeam ? teams.find(t => t.playerIds.includes(player.id)) : null;
                            const isAtMax = selectedPlayerIds.length >= MAX_PLAYERS_PER_TEAM;

                            const isDisabled = isOnAnotherTeam || (isAtMax && !isSelected);

                            return (
                                <div key={player.id} className={`flex items-center space-x-3 p-2 rounded ${isDisabled ? 'opacity-50' : ''}`}>
                                    <input
                                        type="checkbox"
                                        id={`player-${player.id}`}
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onChange={() => handlePlayerToggle(player.id)}
                                        className="h-4 w-4 rounded bg-light-gray border-gray-600 text-cricket-green focus:ring-cricket-green cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <label htmlFor={`player-${player.id}`} className={`flex-grow ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        {player.name}
                                        {isOnAnotherTeam && <span className="text-xs text-accent-yellow ml-2">({teamOfPlayer?.name})</span>}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Modal>
    );
};

const TeamsPage: React.FC = () => {
    const { teams, players, addTeam, deleteTeam } = useApp();
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
    const [addError, setAddError] = useState('');

    const handleAddTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');
        if (newTeamName.trim()) {
            try {
                await addTeam({ name: newTeamName.trim(), playerIds: [] });
                setNewTeamName('');
                setAddModalOpen(false);
            } catch (error: any) {
                setAddError(error.message);
            }
        }
    };
    
    const handleConfirmDelete = async () => {
        if (teamToDelete) {
            await deleteTeam(teamToDelete.id);
            setTeamToDelete(null);
        }
    };
    
    const getPlayerName = (pId: string) => players.find(p => p.id === pId)?.name || 'Unknown';

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Teams Management</h2>
                <Button onClick={() => setAddModalOpen(true)} className="flex items-center space-x-2">
                    <PlusIcon className="w-5 h-5" />
                    <span>Create Team</span>
                </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {teams.map(team => (
                    <Card key={team.id}>
                        <div className="flex justify-between items-start">
                             <h3 className="text-xl font-bold mb-2">{team.name}</h3>
                             <div className="flex space-x-1">
                                <Button variant="secondary" size="sm" onClick={() => setEditingTeam(team)}>Edit</Button>
                                <Button variant="ghost" size="sm" onClick={() => setTeamToDelete(team)}>
                                    <Trash2Icon className="w-5 h-5 text-red-500" />
                                </Button>
                             </div>
                        </div>
                        {team.playerIds.length > 0 ? (
                             <ul className="space-y-1 text-sm">
                                {team.playerIds.slice(0, 5).map(pId => (
                                    <li key={pId} className="text-text-secondary">{getPlayerName(pId)}</li>
                                ))}
                                {team.playerIds.length > 5 && <li className="text-text-secondary text-xs">...and {team.playerIds.length - 5} more</li>}
                            </ul>
                        ) : (
                            <p className="text-text-secondary text-sm">No players in this team yet.</p>
                        )}
                    </Card>
                ))}
            </div>
            <Modal isOpen={isAddModalOpen} onClose={() => { setAddModalOpen(false); setAddError(''); }} title="Create New Team">
                <form onSubmit={handleAddTeam} className="space-y-4">
                    <Input label="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="e.g., India Warriors" required />
                    {addError && <p className="text-red-500 text-sm">{addError}</p>}
                    <div className="flex justify-end pt-2">
                        <Button type="submit">Create Team</Button>
                    </div>
                </form>
            </Modal>
             <EditTeamModal 
                team={editingTeam}
                isOpen={!!editingTeam}
                onClose={() => setEditingTeam(null)}
            />
            <Modal isOpen={!!teamToDelete} onClose={() => setTeamToDelete(null)} title="Confirm Deletion">
                {teamToDelete && (
                    <div className="text-center">
                        <p className="mb-4">Are you sure you want to delete the team "{teamToDelete.name}"? This action cannot be undone.</p>
                        <div className="flex justify-center space-x-4">
                            <Button variant="secondary" onClick={() => setTeamToDelete(null)}>Cancel</Button>
                            <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// Layout Components

const MatchHeader: React.FC = () => {
    const { logout, setActiveMatchId } = useApp();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    return (
        <header className="bg-night-gray p-4 flex justify-between items-center border-b border-light-gray relative">
            <div className="flex items-center space-x-2 md:space-x-4">
                <CricketBallIcon className="w-8 h-8 text-cricket-green" />
                <h1 className="text-xl md:text-2xl font-bold text-text-primary whitespace-nowrap">
                    <span className="hidden sm:inline">Maratha Challengers</span>
                    <span className="sm:hidden">MCCC</span>
                    <span className="hidden lg:inline"> Cricket Club</span>
                </h1>
            </div>
            <nav className="hidden md:flex items-center space-x-4">
                 <Button variant="secondary" onClick={() => setActiveMatchId(null)}>Back to Dashboard</Button>
                 <div className="flex items-center space-x-2 border-l border-light-gray ml-2 pl-4">
                    <ThemeSelector />
                    <Button onClick={logout} variant="ghost" className="flex items-center space-x-2">
                        <LogoutIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                 </div>
            </nav>
            {/* Mobile Nav Button */}
            <div className="md:hidden">
                <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                    {isMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                </Button>
            </div>
            
            {/* Mobile Menu */}
            {isMenuOpen && (
                <nav className="md:hidden absolute top-full right-4 mt-2 w-64 bg-night-gray border border-light-gray rounded-md shadow-lg p-4 z-50 flex flex-col space-y-2">
                    <Button variant="secondary" onClick={() => { setActiveMatchId(null); setIsMenuOpen(false); }}>Back to Dashboard</Button>
                    <div className="border-t border-light-gray my-2"></div>
                    <ThemeSelector />
                    <Button onClick={logout} variant="ghost" className="flex items-center justify-center space-x-2 w-full">
                       <LogoutIcon className="w-5 h-5" />
                       <span>Logout</span>
                    </Button>
                </nav>
            )}
        </header>
    );
};

const MainHeader: React.FC<{ currentPage: string, setCurrentPage: (page: string) => void }> = ({ currentPage, setCurrentPage }) => {
    const { logout } = useApp();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNavClick = (page: string) => {
        setCurrentPage(page);
        setIsMenuOpen(false);
    };

    return (
        <header className="bg-night-gray p-4 flex justify-between items-center border-b border-light-gray relative">
            <div className="flex items-center space-x-2 md:space-x-4">
                <CricketBallIcon className="w-8 h-8 text-cricket-green" />
                <h1 className="text-xl md:text-2xl font-bold text-text-primary whitespace-nowrap">
                    <span className="hidden sm:inline">Maratha Challengers</span>
                    <span className="sm:hidden">MCCC</span>
                    <span className="hidden lg:inline"> Cricket Club</span>
                </h1>
            </div>
            <nav className="hidden md:flex items-center space-x-2 md:space-x-4">
                <Button variant={currentPage === 'dashboard' ? 'primary' : 'ghost'} onClick={() => setCurrentPage('dashboard')}>Dashboard</Button>
                <Button variant={currentPage === 'teams' ? 'primary' : 'ghost'} onClick={() => setCurrentPage('teams')}>Teams</Button>
                <Button variant={currentPage === 'players' ? 'primary' : 'ghost'} onClick={() => setCurrentPage('players')}>Players</Button>
                <Button variant={currentPage === 'stats' ? 'primary' : 'ghost'} onClick={() => setCurrentPage('stats')}>Stats</Button>
                <div className="flex items-center space-x-2 border-l border-light-gray ml-2 pl-4">
                   <ThemeSelector />
                   <Button onClick={logout} variant="ghost" className="flex items-center space-x-2">
                       <LogoutIcon className="w-5 h-5" />
                       <span className="hidden sm:inline">Logout</span>
                   </Button>
                </div>
            </nav>

            {/* Mobile Nav Button */}
            <div className="md:hidden">
                <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                    {isMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                </Button>
            </div>
            
            {/* Mobile Menu */}
            {isMenuOpen && (
                <nav className="md:hidden absolute top-full right-4 mt-2 w-64 bg-night-gray border border-light-gray rounded-md shadow-lg p-4 z-50 flex flex-col space-y-2">
                    <Button variant={currentPage === 'dashboard' ? 'primary' : 'ghost'} onClick={() => handleNavClick('dashboard')}>Dashboard</Button>
                    <Button variant={currentPage === 'teams' ? 'primary' : 'ghost'} onClick={() => handleNavClick('teams')}>Teams</Button>
                    <Button variant={currentPage === 'players' ? 'primary' : 'ghost'} onClick={() => handleNavClick('players')}>Players</Button>
                    <Button variant={currentPage === 'stats' ? 'primary' : 'ghost'} onClick={() => handleNavClick('stats')}>Stats</Button>
                    <div className="border-t border-light-gray my-2"></div>
                    <ThemeSelector />
                    <Button onClick={logout} variant="ghost" className="flex items-center justify-center space-x-2 w-full">
                       <LogoutIcon className="w-5 h-5" />
                       <span>Logout</span>
                    </Button>
                </nav>
            )}
        </header>
    );
};

const LoginPage: React.FC = () => {
    const { login } = useApp();
    return (
         <div className="min-h-screen bg-pitch-dark flex items-center justify-center p-4">
            <Card className="max-w-md w-full text-center">
                <CricketBatIcon className="w-16 h-16 text-cricket-green mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-text-primary mb-2">Maratha Challengers Cricket Club</h1>
                <p className="text-text-secondary mb-8">Your ultimate companion for scoring cricket matches.</p>
                <Button onClick={login}>Enter the Ground</Button>
            </Card>
        </div>
    );
};

// Main App Component

const App: React.FC = () => {
    const { isAuthenticated, activeMatch, updateMatch, matches } = useApp();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [history, setHistory] = useState<Record<string, Match[]>>(() => {
        try {
            const savedHistory = localStorage.getItem('proCricketScorerHistory');
            return savedHistory ? JSON.parse(savedHistory) : {};
        } catch (error) {
            console.error("Could not load match history from local storage:", error);
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('proCricketScorerHistory', JSON.stringify(history));
        } catch (error) {
            console.error("Could not save match history to local storage:", error);
        }
    }, [history]);

    useEffect(() => {
        const matchIds = new Set(matches.map(m => m.id));
        setHistory(prevHistory => {
            const historyKeys = Object.keys(prevHistory);
            const newHistory = { ...prevHistory };
            let hasChanged = false;

            for (const key of historyKeys) {
                if (!matchIds.has(key)) {
                    delete newHistory[key];
                    hasChanged = true;
                }
            }
            return hasChanged ? newHistory : prevHistory;
        });
    }, [matches]);

    const addToHistory = (matchState: Match) => {
        if(activeMatch){
            setHistory(prev => ({
                ...prev,
                [activeMatch.id]: [...(prev[activeMatch.id] || []), matchState]
            }));
        }
    };

    const handleUndo = useCallback(async () => {
        if (activeMatch) {
            const matchHistory = history[activeMatch.id] || [];
            if (matchHistory.length > 0) {
                const lastState = matchHistory[matchHistory.length - 1];
                await updateMatch(lastState);
                setHistory(prev => {
                    const newMatchHistory = (prev[activeMatch.id] || []).slice(0, -1);
                    return {
                        ...prev,
                        [activeMatch.id]: newMatchHistory,
                    };
                });
            }
        }
    }, [activeMatch, history, updateMatch]);
    
    if (!isAuthenticated) return <LoginPage />;

    if (activeMatch) {
        const activeMatchHistory = history[activeMatch.id] || [];
        const inning1NotStarted = activeMatch.status === 'Upcoming' && activeMatch.inning1 && !activeMatch.inning1.onStrikeBatsmanId;
        const inning2NotStarted = activeMatch.status === 'Upcoming' && activeMatch.inning2 && !activeMatch.inning2.onStrikeBatsmanId;
        
        if (inning1NotStarted) {
             return (
                <div className="bg-pitch-dark text-text-primary min-h-screen">
                    <MatchHeader />
                    <main className="p-4 sm:p-6 lg:p-8">
                        <OpeningPlayerSelectionPage />
                    </main>
                </div>
            );
        }

        if (inning2NotStarted) {
             return (
                <div className="bg-pitch-dark text-text-primary min-h-screen">
                    <MatchHeader />
                    <main className="p-4 sm:p-6 lg:p-8">
                        <div className="space-y-6">
                            <OpeningPlayerSelectionPage />
                            <div className="flex justify-center">
                                <Button 
                                    onClick={handleUndo} 
                                    disabled={activeMatchHistory.length === 0}
                                    variant="secondary"
                                    className="flex items-center space-x-2"
                                >
                                    <RotateCcwIcon className="w-5 h-5" />
                                    <span>Undo End of Innings</span>
                                </Button>
                            </div>
                        </div>
                    </main>
                </div>
            );
        }

        return (
            <div className="bg-pitch-dark text-text-primary min-h-screen">
                <MatchHeader />
                <main className="p-4 sm:p-6 lg:p-8">
                    <LiveScoringPage 
                        history={activeMatchHistory}
                        addToHistory={addToHistory}
                        handleUndo={handleUndo}
                    />
                </main>
            </div>
        );
    }
    
    const renderPage = () => {
        switch (currentPage) {
            case 'teams': return <TeamsPage />;
            case 'players': return <PlayersPage />;
            case 'stats': return <StatsPage />;
            case 'dashboard':
            default: return <DashboardPage />;
        }
    };


    return (
        <div className="bg-pitch-dark text-text-primary min-h-screen">
            <MainHeader currentPage={currentPage} setCurrentPage={setCurrentPage} />
            <main className="p-4 sm:p-6 lg:p-8">
                {renderPage()}
            </main>
        </div>
    );
};

export default App;