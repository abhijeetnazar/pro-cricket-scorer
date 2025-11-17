

export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export interface MatchSettings {
  overs: number;
  playersPerTeam: number;
  tossWinnerTeamId: string;
  decision: 'Bat' | 'Bowl';
  rebowlWide?: boolean;
  rebowlNoBall?: boolean;
  wideRuns?: number;
  noBallRuns?: number;
  rebowlWideLastBallOfOver?: boolean;
  rebowlNoBallLastBallOfOver?: boolean;
  rebowlWideAllInLastOver?: boolean;
  rebowlNoBallAllInLastOver?: boolean;
}

export type BallEvent = 'Wicket' | 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye' | 'Run';

export interface Ball {
  ballNumber: number; // 1-6 for legal, 0 for illegal
  overNumber: number;
  runs: number;
  extras: number;
  event: BallEvent | null;
  batsmanId: string;
  bowlerId: string;
  wicket?: {
    playerId: string;
    type: 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped';
    assistingPlayerId?: string;
    secondAssistingPlayerId?: string;
  };
}

export interface Inning {
  battingTeamId: string;
  bowlingTeamId: string;
  score: number;
  wickets: number;
  overs: number;
  balls: number;
  timeline: Ball[];
  batsmanStats: Record<string, { runs: number; balls: number; fours: number; sixes: number; isOut: boolean; retirementReason?: string; }>;
  bowlerStats: Record<string, { overs: number; balls: number; runsConceded: number; wickets: number; maidens: number; }>;
  onStrikeBatsmanId: string;
  nonStrikeBatsmanId: string;
  currentBowlerId: string;
  fallOfWickets: { score: number, wicket: number, over: number, playerId: string }[];
  awaitingNextBowler?: boolean;
}

export interface Match {
  id: string;
  teamAId: string;
  teamBId: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  settings: MatchSettings;
  status: 'Upcoming' | 'In Progress' | 'Finished';
  inning1: Inning;
  inning2?: Inning;
  winnerTeamId?: string;
  resultText?: string;
}