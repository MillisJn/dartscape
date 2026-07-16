import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Player } from "@/core/game/config";
import type { MatchFormat } from "@/core/match/match";
import { newId } from "@/core/newId";
import { configFromJson, configToJson, type Repo, type SavedGame } from "@/core/store/repo";

/**
 * The Repo seam's real implementation (rank 2 — data/). Repo is an interface declared in core/
 * (core stays driver-free); this is the one place that changes if the driver ever does.
 *
 * AsyncStorage, not SQLite: this app has no device to prove a native SQLite driver links, and
 * Dartscape's data volume is a few hundred games at most — a JSON blob under one key is plenty.
 * Swapping to op-sqlite later touches only this file, per the architecture's own promise for the
 * Repo seam. Logged in PLAN.md's decisions log.
 */

const PLAYERS_KEY = "dartscape:players";
const GAMES_KEY = "dartscape:games";

interface StoredPlayer extends Player {
  readonly createdAt: number;
}

// SavedGame's config/format are stored as JSON strings on disk (mirroring the SQLite schema's
// config_json/format_json columns) so a future SQLite driver reads back an identical shape.
interface StoredGame {
  readonly id: string;
  readonly playedAt: number;
  readonly configJson: string;
  readonly formatJson: string | null;
  readonly winner: number | null;
  readonly players: readonly Player[];
  readonly log: SavedGame["log"];
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toStoredGame(game: SavedGame): StoredGame {
  return {
    id: game.id,
    playedAt: game.playedAt,
    configJson: configToJson(game.config),
    formatJson: game.format ? JSON.stringify(game.format) : null,
    winner: game.winner,
    players: game.players,
    log: game.log,
  };
}

function fromStoredGame(stored: StoredGame): SavedGame {
  return {
    id: stored.id,
    playedAt: stored.playedAt,
    config: configFromJson(stored.configJson),
    format: stored.formatJson ? (JSON.parse(stored.formatJson) as MatchFormat) : null,
    winner: stored.winner,
    players: stored.players,
    log: stored.log,
  };
}

export function asyncStorageRepo(): Repo {
  return {
    async init() {
      // AsyncStorage needs no schema setup — reads default to empty via readJson's fallback.
    },

    async createPlayer(name) {
      const players = await readJson<StoredPlayer[]>(PLAYERS_KEY, []);
      if (players.some((p) => p.name === name)) {
        throw new Error(`player already exists: ${name}`);
      }
      const player: StoredPlayer = {
        id: newId(),
        name,
        createdAt: Date.now(),
      };
      await AsyncStorage.setItem(PLAYERS_KEY, JSON.stringify([...players, player]));
      return { id: player.id, name: player.name };
    },

    async renamePlayer(id, name) {
      const players = await readJson<StoredPlayer[]>(PLAYERS_KEY, []);
      if (!players.some((p) => p.id === id)) {
        throw new Error(`no such player: ${id}`);
      }
      if (players.some((p) => p.id !== id && p.name === name)) {
        throw new Error(`player already exists: ${name}`);
      }
      const next = players.map((p) => (p.id === id ? { ...p, name } : p));
      await AsyncStorage.setItem(PLAYERS_KEY, JSON.stringify(next));
    },

    async deletePlayer(id) {
      const players = await readJson<StoredPlayer[]>(PLAYERS_KEY, []);
      await AsyncStorage.setItem(PLAYERS_KEY, JSON.stringify(players.filter((p) => p.id !== id)));
      const games = await readJson<StoredGame[]>(GAMES_KEY, []);
      const keep = games.filter((g) => !g.players.some((p) => p.id === id));
      await AsyncStorage.setItem(GAMES_KEY, JSON.stringify(keep));
    },

    async allPlayers() {
      const players = await readJson<StoredPlayer[]>(PLAYERS_KEY, []);
      return [...players]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(({ id, name }) => ({ id, name }));
    },

    async saveGame(game) {
      const games = await readJson<StoredGame[]>(GAMES_KEY, []);
      await AsyncStorage.setItem(GAMES_KEY, JSON.stringify([...games, toStoredGame(game)]));
    },

    async gamesFor(playerId, limit) {
      const games = await readJson<StoredGame[]>(GAMES_KEY, []);
      const found = games
        .filter((g) => g.players.some((p) => p.id === playerId))
        .sort((a, b) => b.playedAt - a.playedAt)
        .map(fromStoredGame);
      return limit === undefined ? found : found.slice(0, limit);
    },

    async allGames(limit) {
      const games = await readJson<StoredGame[]>(GAMES_KEY, []);
      const found = games.sort((a, b) => b.playedAt - a.playedAt).map(fromStoredGame);
      return limit === undefined ? found : found.slice(0, limit);
    },

    async deleteAllGames() {
      await AsyncStorage.setItem(GAMES_KEY, JSON.stringify([]));
    },
  };
}
