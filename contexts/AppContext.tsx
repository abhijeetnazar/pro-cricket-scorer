import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import type { Player, Team, Match, MatchSettings } from '../types';
import { CricketBallIcon } from '../components/icons';
import {
  dbGetPlayers, dbAddPlayer, dbUpdatePlayer, dbDeletePlayer,
  dbGetTeams, dbAddTeam, dbUpdateTeam, dbDeleteTeam,
  dbGetMatches, dbAddMatch, dbUpdateMatch, dbDeleteMatch,
  seedInitialData
} from '../lib/database';
import { themes } from '../themes';

interface AppContextType {
  isAuthenticated: boolean;
  players: Player[];
  teams: Team[];
  matches: Match[];
  activeMatch: Match | null;
  theme: string;
  setTheme: (themeName: string) => void;
  login: () => void;
  logout: () => void;
  addPlayer: (player: Omit<Player, 'id'>) => Promise<void>;
  updatePlayer: (player: Player) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  addTeam: (team: Omit<Team, 'id'>) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  updateTeam: (team: Team) => Promise<void>;
  createMatch: (settings: MatchSettings, teamAId: string, teamBId: string, teamAPlayers: string[], teamBPlayers: string[]) => Promise<string>;
  setActiveMatchId: (matchId: string | null) => void;
  updateMatch: (updatedMatch: Match) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  importFromGoogleSheet: (sheetUrl: string, sheetName: string) => Promise<void>;
  importMatchData: (matchJson: string) => Promise<void>;
  backupAllData: () => void;
  restoreAllData: (jsonData: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('proCricketScorerTheme') || themes[0].name;
  });

  useEffect(() => {
    const selectedTheme = themes.find(t => t.name === theme);
    if (selectedTheme) {
      const root = document.documentElement;
      Object.entries(selectedTheme.colors).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      localStorage.setItem('proCricketScorerTheme', theme);
    }
  }, [theme]);
  
  const setTheme = (themeName: string) => {
    setThemeState(themeName);
  };

  useEffect(() => {
    const initialize = async () => {
      if (isAuthenticated) {
        try {
          setIsLoading(true);
          await seedInitialData(); 
          const [playersFromDb, teamsFromDb, matchesFromDb] = await Promise.all([
            dbGetPlayers(),
            dbGetTeams(),
            dbGetMatches(),
          ]);
          setPlayers(playersFromDb);
          setTeams(teamsFromDb);
          setMatches(matchesFromDb);
        } catch (error) {
          console.error("Failed to fetch data from database:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    initialize();
  }, [isAuthenticated]);

  const login = () => setIsAuthenticated(true); 
  const logout = () => {
    setIsAuthenticated(false);
    setActiveMatchId(null);
  };

  const addPlayer = async (player: Omit<Player, 'id'>) => {
    const newPlayer = { ...player, id: `p${Date.now()}` };
    await dbAddPlayer(newPlayer);
    setPlayers(prev => [...prev, newPlayer]);
  };

  const updatePlayer = async (player: Player) => {
      await dbUpdatePlayer(player);
      setPlayers(prev => prev.map(p => p.id === player.id ? player : p));
  };

  const deletePlayer = async (playerId: string) => {
    const teamsWithPlayer = teams.filter(t => t.playerIds.includes(playerId));
    const updatedTeams = teamsWithPlayer.map(t => ({
        ...t,
        playerIds: t.playerIds.filter(id => id !== playerId),
    }));

    await Promise.all([
        dbDeletePlayer(playerId),
        ...updatedTeams.map(t => dbUpdateTeam(t))
    ]);

    setPlayers(prev => prev.filter(p => p.id !== playerId));
    setTeams(prev => {
        const updatedTeamsMap = new Map(updatedTeams.map(t => [t.id, t]));
        return prev.map(t => updatedTeamsMap.get(t.id) || t);
    });
  };

  const addTeam = async (team: Omit<Team, 'id'>) => {
    if (teams.some(t => t.name.trim().toLowerCase() === team.name.trim().toLowerCase())) {
        throw new Error(`A team with the name "${team.name}" already exists.`);
    }
    const newTeam = { ...team, id: `t${Date.now()}` };
    await dbAddTeam(newTeam);
    setTeams(prev => [...prev, newTeam]);
  };

  const updateTeam = async (updatedTeam: Team) => {
    if (teams.some(t => t.id !== updatedTeam.id && t.name.trim().toLowerCase() === updatedTeam.name.trim().toLowerCase())) {
        throw new Error(`A team with the name "${updatedTeam.name}" already exists.`);
    }
    await dbUpdateTeam(updatedTeam);
    setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
  };
  
  const deleteTeam = async (teamId: string) => {
    await dbDeleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  };

  const createMatch = useCallback(async (settings: MatchSettings, teamAId: string, teamBId: string, teamAPlayers: string[], teamBPlayers: string[]): Promise<string> => {
    const battingTeamId = settings.decision === 'Bat' ? settings.tossWinnerTeamId : (settings.tossWinnerTeamId === teamAId ? teamBId : teamAId);
    const bowlingTeamId = battingTeamId === teamAId ? teamBId : teamAId;
    const battingTeamPlayers = battingTeamId === teamAId ? teamAPlayers : teamBPlayers;
    const bowlingTeamPlayers = battingTeamId === teamAId ? teamBPlayers : teamAPlayers;

    const matchPayload = {
      teamAId, teamBId, teamAPlayers, teamBPlayers, settings,
      inning1: {
        battingTeamId, bowlingTeamId, score: 0, wickets: 0, overs: 0, balls: 0, timeline: [],
        batsmanStats: Object.fromEntries(battingTeamPlayers.map(pId => [pId, { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false }])),
        bowlerStats: Object.fromEntries(bowlingTeamPlayers.map(pId => [pId, { overs: 0, balls: 0, runsConceded: 0, wickets: 0, maidens: 0 }])),
        onStrikeBatsmanId: '',
        nonStrikeBatsmanId: '',
        currentBowlerId: '',
        fallOfWickets: [],
      }
    };
    
    const newMatch = { ...matchPayload, id: `m${Date.now()}`, status: 'Upcoming' } as Match;
    await dbAddMatch(newMatch);
    setMatches(prev => [newMatch, ...prev]);
    return newMatch.id;
  }, []);

  const updateMatch = async (updatedMatch: Match) => {
    await dbUpdateMatch(updatedMatch);
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
  };

  const deleteMatch = async (matchId: string) => {
    if (activeMatchId === matchId) {
        setActiveMatchId(null);
    }
    await dbDeleteMatch(matchId);
    setMatches(prev => prev.filter(m => m.id !== matchId));
  };

  const importFromGoogleSheet = async (sheetUrl: string, sheetName: string) => {
    const sheetIdRegex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(sheetIdRegex);
    if (!match || !match[1]) {
        throw new Error("Invalid Google Sheet URL.");
    }
    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    let csvText: string;
    try {
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Failed to fetch sheet data (status: ${response.status}). Make sure the sheet is public and the name is correct.`);
        csvText = await response.text();
    } catch (error) {
        throw new Error("Could not connect to Google Sheets. Check your network, URL, and sheet name.");
    }

    const rows = csvText.split('\n').filter(row => row.trim() !== '').map(row => 
        row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    );
    if (rows.length < 2) throw new Error("Sheet is empty or contains only a header.");

    const header = rows[0].map(h => h.toLowerCase().trim());
    const playerIndex = header.indexOf('player');
    const teamIndex = header.indexOf('team');
    const roleIndex = header.indexOf('role');

    if (playerIndex === -1 || teamIndex === -1) {
        throw new Error("Sheet header must contain 'player' and 'team' columns.");
    }
    
    const existingPlayers = [...players];
    const playerCache: Map<string, Player> = new Map();
    existingPlayers.forEach(p => playerCache.set(p.name.toLowerCase(), p));
    
    const existingTeams = [...teams];
    const teamCache: Map<string, Team> = new Map();
    existingTeams.forEach(t => teamCache.set(t.name.toLowerCase(), t));
    
    const teamPlayerAssignments: Map<string, Set<string>> = new Map();
    existingTeams.forEach(t => teamPlayerAssignments.set(t.id, new Set(t.playerIds)));

    const validRoles: Player['role'][] = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'];

    rows.slice(1).forEach(row => {
        const playerName = row[playerIndex];
        const teamName = row[teamIndex];
        const roleRaw = roleIndex !== -1 ? row[roleIndex] : '';
        
        if (!playerName || !teamName) return;

        const playerNameLower = playerName.toLowerCase();
        const teamNameLower = teamName.toLowerCase();

        let playerRole: Player['role'] = 'All-Rounder';
        if (roleRaw) {
            const matchedRole = validRoles.find(r => r.toLowerCase() === roleRaw.trim().toLowerCase());
            if (matchedRole) playerRole = matchedRole;
        }

        let player = playerCache.get(playerNameLower);
        if (player) {
            if (player.role !== playerRole) {
                player = { ...player, role: playerRole };
                playerCache.set(playerNameLower, player);
            }
        } else {
            player = { id: `p${Date.now()}${Math.random()}`, name: playerName, role: playerRole };
            playerCache.set(playerNameLower, player);
        }
        
        let team = teamCache.get(teamNameLower);
        if (!team) {
            team = { id: `t${Date.now()}${Math.random()}`, name: teamName, playerIds: [] };
            teamCache.set(teamNameLower, team);
        }
        
        if (!teamPlayerAssignments.has(team.id)) {
            teamPlayerAssignments.set(team.id, new Set());
        }
        teamPlayerAssignments.get(team.id)!.add(player.id);
    });

    const playersToCreate: Player[] = [];
    const playersToUpdate: Player[] = [];
    playerCache.forEach(player => {
        const original = existingPlayers.find(p => p.id === player.id);
        if (!original) {
            playersToCreate.push(player);
        } else if (original.role !== player.role) {
            playersToUpdate.push(player);
        }
    });

    const finalTeams: Team[] = [];
    teamCache.forEach(team => {
        const playerIds = Array.from(teamPlayerAssignments.get(team.id) || []);
        finalTeams.push({ ...team, playerIds });
    });

    const teamsToCreate = finalTeams.filter(t => !existingTeams.find(et => et.id === t.id));
    const teamsToUpdate = finalTeams.filter(t => {
        const original = existingTeams.find(et => et.id === t.id);
        if (!original) return false;
        const originalIds = new Set(original.playerIds);
        return t.playerIds.length !== originalIds.size || t.playerIds.some(id => !originalIds.has(id));
    });

    await Promise.all([
        ...playersToCreate.map(p => dbAddPlayer(p)),
        ...playersToUpdate.map(p => dbUpdatePlayer(p)),
        ...teamsToCreate.map(t => dbAddTeam(t)),
        ...teamsToUpdate.map(t => dbUpdateTeam(t)),
    ]);

    const finalPlayers = await dbGetPlayers();
    const finalDbTeams = await dbGetTeams();

    setPlayers(finalPlayers);
    setTeams(finalDbTeams);
  };

  const backupAllData = () => {
    const dataToBackup = {
      players: players,
      teams: teams,
      matches: matches,
    };
    const jsonString = JSON.stringify(dataToBackup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `pro-cricket-scorer-backup-${date}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const performNonDestructiveImport = async (data: { players?: Player[], teams?: Team[], matches?: Match[] }) => {
    const { players: playersToImport = [], teams: teamsToImport = [], matches: matchesToImport = [] } = data;
    
    const currentPlayerNames = new Set(players.map(p => p.name.trim().toLowerCase()));
    const newPlayers = playersToImport.filter(p => !currentPlayerNames.has(p.name.trim().toLowerCase()));

    const currentTeamNames = new Set(teams.map(t => t.name.trim().toLowerCase()));
    const newTeams = teamsToImport.filter(t => !currentTeamNames.has(t.name.trim().toLowerCase()));

    const currentMatchIds = new Set(matches.map(m => m.id));
    const newMatches = matchesToImport.filter(m => !currentMatchIds.has(m.id));

    await Promise.all([
      ...newPlayers.map(p => dbUpdatePlayer(p)),
      ...newTeams.map(t => dbUpdateTeam(t)),
      ...newMatches.map(m => dbUpdateMatch(m)),
    ]);

    const [playersFromDb, teamsFromDb, matchesFromDb] = await Promise.all([
      dbGetPlayers(),
      dbGetTeams(),
      dbGetMatches(),
    ]);

    setPlayers(playersFromDb);
    setTeams(teamsFromDb);
    setMatches(matchesFromDb);
  };
  
  const restoreAllData = async (jsonString: string) => {
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch {
      throw new Error("Invalid backup file. Must be valid JSON.");
    }
    if (!parsedData.players || !parsedData.teams || !parsedData.matches) {
      throw new Error("Backup file is missing required data sections (players, teams, matches).");
    }
    await performNonDestructiveImport({
      players: parsedData.players,
      teams: parsedData.teams,
      matches: parsedData.matches,
    });
  };

  const importMatchData = async (matchJson: string) => {
    let parsedData: any;
    try {
        parsedData = JSON.parse(matchJson);
    } catch (error) {
        throw new Error("Invalid file format. Please upload a valid JSON match file.");
    }

    const isNewFormat = parsedData.matchData && parsedData.playersData && parsedData.teamsData;
    const match = isNewFormat ? parsedData.matchData : parsedData;

    if (!match.id || !match.settings || !match.inning1 || !match.teamAId || !match.teamBId) {
        throw new Error("The provided file is not a valid match file. Required fields are missing.");
    }
    
    const playersToImport = isNewFormat ? parsedData.playersData : [];
    const teamsToImport = isNewFormat ? parsedData.teamsData : [];

    await performNonDestructiveImport({
        players: playersToImport,
        teams: teamsToImport,
        matches: [match],
    });
  };

  const activeMatch = matches.find(m => m.id === activeMatchId) || null;

  const value = {
    isAuthenticated, players, teams, matches, activeMatch, login, logout, addPlayer, deletePlayer, addTeam,
    deleteTeam, updateTeam, createMatch, setActiveMatchId, updateMatch, deleteMatch, importFromGoogleSheet,
    importMatchData, updatePlayer, theme, setTheme, backupAllData, restoreAllData,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pitch-dark flex items-center justify-center">
        <div className="text-center">
            <CricketBallIcon className="w-16 h-16 text-cricket-green animate-spin mx-auto" />
            <p className="mt-4 text-text-secondary">Loading Scorer...</p>
        </div>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
