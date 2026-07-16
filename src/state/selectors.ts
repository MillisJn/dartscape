import type { GameEvent } from "@/core/game/events";
import { reduce, view } from "@/core/game/registry";
import type { GameView } from "@/core/game/view";
import { type MatchState, matchState } from "@/core/match/match";
import { computeStats, type Stats } from "@/core/stats/stats";

import type { MatchStoreState } from "./matchStore";

/**
 * Memoised view/stats derivation over the store's three fields. `reduce` re-folds the whole log
 * on every read — deliberately not optimised (a game is ~60 darts; see core/PLAN.md) — so undo
 * can never be wrong: it's just a shorter log through the same fold.
 */

/** The read model for whatever's on the board right now, or null before a match has started. */
export function selectView(state: MatchStoreState): GameView | null {
  if (!state.config) return null;
  return view(reduce(state.config, state.players, state.log).state);
}

/** The events the *last* dart in the log produced — what just happened, for effects to react to. */
export function selectEvents(state: MatchStoreState): readonly GameEvent[] {
  if (!state.config) return [];
  return reduce(state.config, state.players, state.log).events;
}

/** The match's standing (legs/sets won, overall winner) from its finished-leg results. */
export function selectMatchState(state: MatchStoreState): MatchState {
  const playerIds = state.players.map((p) => p.id);
  return matchState(state.format, playerIds, state.results);
}

/**
 * A seat's live stats (3-dart average, MPR, ...) for the leg in progress — computeStats doesn't
 * care whether the game it's handed is actually finished, only what's in the log, so the current
 * (unfinished) leg is a perfectly good "completed game" as far as the stats math is concerned.
 */
export function selectLiveStats(state: MatchStoreState, seat: number): Stats | null {
  const player = state.players[seat];
  if (!state.config || !player) return null;
  return computeStats(
    [
      {
        id: "live",
        config: state.config,
        players: state.players,
        log: state.log,
        winner: null,
        playedAt: 0,
      },
    ],
    player.id,
  );
}
