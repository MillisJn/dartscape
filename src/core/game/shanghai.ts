import { type Bed, isMiss, points, type Wedge } from "../board";
import type { ConfigOf, Player } from "./config";
import {
  type CommonState,
  type GameEngine,
  initCommon,
  type StepResult,
  THREE_DARTS,
} from "./engine";
import type { GameEvent } from "./events";
import type { GameView, PlayerView } from "./view";

/**
 * Shanghai — one number per round, walking `from` to `to`. Only that round's
 * number scores.
 *
 * Hit its single, double and treble in a single visit and you have shanghaied:
 * instant win, whatever the scores. Otherwise the highest score at the end
 * takes it, ties broken on trebles.
 *
 * `from > to` walks backwards, so classic 1–7 and the full 1–20 are the same
 * config with different numbers.
 */

export interface ShanghaiState extends CommonState {
  readonly kind: "shanghai";
  readonly config: ConfigOf<"shanghai">;
  /** Trebles hit, per seat — the tie-break. */
  readonly trebles: readonly number[];
}

const direction = (c: ConfigOf<"shanghai">): 1 | -1 => (c.to >= c.from ? 1 : -1);

export const totalRounds = (c: ConfigOf<"shanghai">): number => Math.abs(c.to - c.from) + 1;

/** The number in play for a round. Derived, so it can never drift from `round`. */
export function targetFor(c: ConfigOf<"shanghai">, round: number): Wedge {
  const n = c.from + direction(c) * round;
  return Math.min(20, Math.max(1, n)) as Wedge;
}

const lastActiveSeat = (s: CommonState): number => {
  for (let i = s.players.length - 1; i >= 0; i--) if (s.active[i] === true) return i;
  return 0;
};

/** Highest score wins; ties go to whoever hit more trebles. */
function bestSeat(s: ShanghaiState): number {
  let best = 0;
  for (let i = 1; i < s.players.length; i++) {
    if (s.active[i] !== true) continue;
    const mine = s.scores[i] ?? 0;
    const top = s.scores[best] ?? 0;
    if (mine > top) best = i;
    else if (mine === top && (s.trebles[i] ?? 0) > (s.trebles[best] ?? 0)) best = i;
  }
  return best;
}

export const shanghaiEngine: GameEngine<ConfigOf<"shanghai">, ShanghaiState> = {
  kind: "shanghai",
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): ShanghaiState {
    return {
      ...initCommon(players, 0),
      kind: "shanghai",
      config,
      trebles: players.map(() => 0),
    };
  },

  step(state, dart): StepResult<ShanghaiState> {
    const seat = state.visit.seat;
    const target = targetFor(state.config, state.round);
    const onTarget = !isMiss(dart) && "wedge" in dart && dart.wedge === target;

    let next: ShanghaiState = state;
    const events: GameEvent[] = [];

    if (onTarget) {
      const scored = points(dart);
      next = {
        ...state,
        scores: state.scores.map((v, i) => (i === seat ? v + scored : v)),
        trebles: state.trebles.map((v, i) => (i === seat && dart.ring === "treble" ? v + 1 : v)),
      };
      events.push({ type: "dartScored", seat, dart, points: scored });
    } else {
      events.push({ type: "dartMissed", seat, dart });
    }

    // Shanghai: single, double and treble of the number in one visit.
    const visit = [...state.visit.darts, dart];
    const rings = new Set(
      visit.filter((d) => "wedge" in d && d.wedge === target).map((d) => d.ring),
    );
    if (rings.has("single") && rings.has("double") && rings.has("treble")) {
      return {
        state: { ...next, winner: seat },
        events: [...events, { type: "shanghai", seat, target }, { type: "won", seat }],
      };
    }

    // Last dart of the last round: whoever is ahead takes it.
    const isLastDart =
      next.round >= totalRounds(next.config) - 1 &&
      seat === lastActiveSeat(next) &&
      next.visit.darts.length === 2;

    if (isLastDart) {
      const winner = bestSeat(next);
      return {
        state: { ...next, winner },
        events: [...events, { type: "won", seat: winner }],
      };
    }

    return { state: next, events };
  },

  aim(state): Bed {
    const target = targetFor(state.config, state.round);
    const visit = state.visit.darts.filter((d) => "wedge" in d && d.wedge === target);
    const rings = new Set(visit.map((d) => d.ring));
    const missedOne = state.visit.darts.length > visit.length;

    // A shanghai is still live only if nothing has been wasted this visit. Then
    // it is worth collecting the ring we are missing; otherwise just score.
    if (!missedOne && state.visit.darts.length > 0) {
      if (!rings.has("treble")) return { ring: "treble", wedge: target };
      if (!rings.has("double")) return { ring: "double", wedge: target };
      if (!rings.has("single")) return { ring: "single", wedge: target };
    }
    return { ring: "treble", wedge: target };
  },

  view(state): GameView {
    const seat = state.visit.seat;
    const players: PlayerView[] = state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: state.scores[i] ?? 0,
      isBot: p.sigma !== undefined,
      isActive: state.active[i] === true,
      isThrowing: i === seat && state.winner === null,
    }));

    return {
      kind: "shanghai",
      players,
      visit: {
        seat,
        darts: state.visit.darts,
        points: state.visit.darts.reduce((sum, d) => sum + points(d), 0),
        dartsLeft: 3 - state.visit.darts.length,
      },
      round: state.round,
      winner: state.winner,
      panel: {
        kind: "shanghai",
        target: targetFor(state.config, state.round),
        round: state.round + 1,
        lastRound: totalRounds(state.config),
      },
    };
  },
};
