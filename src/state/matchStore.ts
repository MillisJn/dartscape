import { create } from "zustand";

import type { Dart } from "@/core/board";
import type { GameConfig, Player } from "@/core/game/config";
import type { LegResult, MatchFormat } from "@/core/match/match";

/**
 * `{ config, players, log, format, results }` and nothing else — everything else (whose turn it
 * is, scores, the winner, checkout hints) is derived on read via state/selectors.ts. A dart is
 * `log.push`; undo is `log.pop`; an upgrade (single -> double/treble) is pop-then-push. That's the
 * whole seam between a finger (or a bot timer) and the core's reduce().
 */

export interface MatchStoreState {
  readonly config: GameConfig | null;
  readonly players: readonly Player[];
  readonly log: readonly Dart[];
  readonly format: MatchFormat;
  /** This match's finished legs, most recent last. */
  readonly results: readonly LegResult[];
}

export interface MatchStoreActions {
  /** Begin a new match: a fresh log, a fresh results list. */
  start(config: GameConfig, players: readonly Player[], format?: MatchFormat): void;
  throwDart(dart: Dart): void;
  undo(): void;
  /** Pop the last dart, push its replacement — the gesture's "upgrade" emit, one log op. */
  upgrade(dart: Dart): void;
  recordLegResult(winnerPlayerId: string): void;
  /** Same match, same config: a fresh leg with (possibly reseated) players. */
  startNextLeg(seatedPlayers: readonly Player[]): void;
  /** Back to nothing — leaving the game screen. */
  reset(): void;
}

export type MatchStore = MatchStoreState & MatchStoreActions;

const DEFAULT_FORMAT: MatchFormat = { kind: "single" };

const EMPTY_STATE: MatchStoreState = {
  config: null,
  players: [],
  log: [],
  format: DEFAULT_FORMAT,
  results: [],
};

export const useMatchStore = create<MatchStore>((set) => ({
  ...EMPTY_STATE,

  start(config, players, format = DEFAULT_FORMAT) {
    set({ config, players: [...players], log: [], format, results: [] });
  },

  throwDart(dart) {
    set((s) => ({ log: [...s.log, dart] }));
  },

  undo() {
    set((s) => ({ log: s.log.slice(0, -1) }));
  },

  upgrade(dart) {
    set((s) => ({ log: [...s.log.slice(0, -1), dart] }));
  },

  recordLegResult(winnerPlayerId) {
    set((s) => ({ results: [...s.results, { winner: winnerPlayerId }] }));
  },

  startNextLeg(seatedPlayers) {
    set({ players: [...seatedPlayers], log: [] });
  },

  reset() {
    set(EMPTY_STATE);
  },
}));
