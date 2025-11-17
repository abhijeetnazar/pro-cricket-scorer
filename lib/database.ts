import { openDB } from 'idb';
import type { Player, Team, Match } from '../types';
import { initialPlayers, initialTeams } from '../contexts/initialData';

const DB_NAME = 'ProCricketScorerDB';
const DB_VERSION = 1;

const openDatabase = async () => {
  return openDB<any>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('players')) {
          db.createObjectStore('players', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('teams')) {
          db.createObjectStore('teams', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('matches')) {
          db.createObjectStore('matches', { keyPath: 'id' });
        }
      }
    },
  });
};

// Seeding function
export const seedInitialData = async () => {
    const db = await openDatabase();
    const playersCount = await db.count('players');
    if (playersCount === 0) {
        console.log("Seeding initial players...");
        const tx = db.transaction('players', 'readwrite');
        await Promise.all(initialPlayers.map(player => tx.store.add(player)));
        await tx.done;
    }
    const teamsCount = await db.count('teams');
    if (teamsCount === 0) {
        console.log("Seeding initial teams...");
        const tx = db.transaction('teams', 'readwrite');
        await Promise.all(initialTeams.map(team => tx.store.add(team)));
        await tx.done;
    }
};

// Generic functions
const getAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await openDatabase();
    return db.getAll(storeName);
};

const add = async <T>(storeName: string, item: T): Promise<T> => {
    const db = await openDatabase();
    await db.add(storeName, item);
    return item;
};

const put = async <T>(storeName: string, item: T): Promise<T> => {
    const db = await openDatabase();
    await db.put(storeName, item);
    return item;
};

const del = async (storeName: string, key: IDBValidKey): Promise<void> => {
    const db = await openDatabase();
    await db.delete(storeName, key);
};

// Player functions
export const dbGetPlayers = () => getAll<Player>('players');
export const dbAddPlayer = (player: Player) => add<Player>('players', player);
export const dbUpdatePlayer = (player: Player) => put<Player>('players', player);
export const dbDeletePlayer = (playerId: string) => del('players', playerId);

// Team functions
export const dbGetTeams = () => getAll<Team>('teams');
export const dbAddTeam = (team: Team) => add<Team>('teams', team);
export const dbUpdateTeam = (team: Team) => put<Team>('teams', team);
export const dbDeleteTeam = (teamId: string) => del('teams', teamId);

// Match functions
export const dbGetMatches = async (): Promise<Match[]> => {
    const matches = await getAll<Match>('matches');
    return matches.sort((a, b) => b.id.localeCompare(a.id)); // sort descending by id (timestamp)
};
export const dbAddMatch = (match: Match) => add<Match>('matches', match);
export const dbUpdateMatch = (match: Match) => put<Match>('matches', match);
export const dbDeleteMatch = (matchId: string) => del('matches', matchId);