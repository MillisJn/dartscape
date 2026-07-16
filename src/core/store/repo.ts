import type { Dart, Ring, Wedge } from "../board";
import type { GameConfig, Player } from "../game/config";
import type { MatchFormat } from "../match/match";
import type { CompletedGame } from "../stats/stats";

/**
 * Persistence.
 *
 * The core stays driver-free: this is an interface, the SQLite driver is
 * injected at the edge, and the tests run against an in-memory fake. Nothing
 * here imports a native module, which is what keeps `npm test` runnable in node.
 *
 * The schema stores the *log*, not computed stats. The old schema gave every
 * stat its own column, which means adding a stat needs a migration and comes
 * back blank for all history — and means checkout % can never be recovered at
 * all, because the darts weren't kept. Store what happened; derive the rest.
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,
  played_at   INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  format_json TEXT,
  winner_seat INTEGER
);

CREATE TABLE IF NOT EXISTS game_players (
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seat       INTEGER NOT NULL,
  bot_sigma  REAL,
  PRIMARY KEY (game_id, seat)
);

CREATE TABLE IF NOT EXISTS darts (
  game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL,
  ring     TEXT NOT NULL,
  wedge    INTEGER,
  PRIMARY KEY (game_id, seq)
);

CREATE INDEX IF NOT EXISTS games_played_at ON games(played_at DESC);
CREATE INDEX IF NOT EXISTS game_players_player ON game_players(player_id);
`;

export interface SavedGame extends CompletedGame {
  readonly format: MatchFormat | null;
}

export interface Repo {
  init(): Promise<void>;

  createPlayer(name: string): Promise<Player>;
  renamePlayer(id: string, name: string): Promise<void>;
  deletePlayer(id: string): Promise<void>;
  allPlayers(): Promise<readonly Player[]>;

  saveGame(game: SavedGame): Promise<void>;
  /** Most recent first. */
  gamesFor(playerId: string, limit?: number): Promise<readonly SavedGame[]>;
  allGames(limit?: number): Promise<readonly SavedGame[]>;
  deleteAllGames(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Serialisation
//
// A Dart is (ring, wedge) with wedge absent for the bulls and misses. Two
// columns, no JSON per row, and the whole log reads back as one query.
// ---------------------------------------------------------------------------

export interface DartRow {
  readonly ring: string;
  readonly wedge: number | null;
}

export const dartToRow = (d: Dart): DartRow => ({
  ring: d.ring,
  wedge: "wedge" in d ? d.wedge : null,
});

export function rowToDart(row: DartRow): Dart {
  const ring = row.ring as Ring | "miss";
  switch (ring) {
    case "miss":
      return { ring: "miss" };
    case "innerBull":
      return { ring: "innerBull" };
    case "outerBull":
      return { ring: "outerBull" };
    case "single":
    case "double":
    case "treble":
      if (row.wedge === null) throw new Error(`${ring} dart has no wedge`);
      return { ring, wedge: row.wedge as Wedge };
    default:
      throw new Error(`unknown ring: ${row.ring}`);
  }
}

export const configToJson = (c: GameConfig): string => JSON.stringify(c);
export const configFromJson = (s: string): GameConfig => JSON.parse(s) as GameConfig;

// ---------------------------------------------------------------------------
// In-memory implementation
//
// Not just a test double: it's the reference for what the SQLite driver has to
// do, and it means every stats test runs without a database.
// ---------------------------------------------------------------------------

export function memoryRepo(now: () => number = Date.now): Repo {
  const players = new Map<string, Player & { createdAt: number }>();
  const games = new Map<string, SavedGame>();
  let nextId = 1;

  return {
    async init() {},

    async createPlayer(name) {
      if ([...players.values()].some((p) => p.name === name)) {
        throw new Error(`player already exists: ${name}`);
      }
      const player = { id: `p${nextId++}`, name, createdAt: now() };
      players.set(player.id, player);
      return { id: player.id, name: player.name };
    },

    async renamePlayer(id, name) {
      const p = players.get(id);
      if (!p) throw new Error(`no such player: ${id}`);
      if ([...players.values()].some((other) => other.id !== id && other.name === name)) {
        throw new Error(`player already exists: ${name}`);
      }
      players.set(id, { ...p, name });
    },

    async deletePlayer(id) {
      players.delete(id);
      for (const [gid, g] of games) {
        if (g.players.some((p) => p.id === id)) games.delete(gid);
      }
    },

    async allPlayers() {
      return [...players.values()]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(({ id, name }) => ({ id, name }));
    },

    async saveGame(game) {
      games.set(game.id, game);
    },

    async gamesFor(playerId, limit) {
      const found = [...games.values()]
        .filter((g) => g.players.some((p) => p.id === playerId))
        .sort((a, b) => b.playedAt - a.playedAt);
      return limit === undefined ? found : found.slice(0, limit);
    },

    async allGames(limit) {
      const found = [...games.values()].sort((a, b) => b.playedAt - a.playedAt);
      return limit === undefined ? found : found.slice(0, limit);
    },

    async deleteAllGames() {
      games.clear();
    },
  };
}
