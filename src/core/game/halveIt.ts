import { type Bed, type Dart, points, type Wedge } from "../board";
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
 * Halve It — seven targets, three darts each. Score whatever you hit. Blank a
 * round entirely and your total is cut in half.
 *
 * The halving is the whole game: it turns a scoring exercise into a nerve test,
 * because a good total is worth more the longer you hold it. Everyone plays the
 * last two rounds differently.
 */

/** A round's target. Two of them aren't numbers at all, which is the fun of it. */
export type HalveItTarget =
  | { readonly kind: "number"; readonly wedge: Wedge }
  | { readonly kind: "anyDouble" }
  | { readonly kind: "anyTreble" }
  | { readonly kind: "bull" };

/** The classic sequence. */
export const HALVE_IT_ROUNDS: readonly HalveItTarget[] = [
  { kind: "number", wedge: 20 },
  { kind: "number", wedge: 19 },
  { kind: "number", wedge: 18 },
  { kind: "anyDouble" },
  { kind: "number", wedge: 17 },
  { kind: "anyTreble" },
  { kind: "bull" },
];

export function describeTarget(t: HalveItTarget): string {
  switch (t.kind) {
    case "number":
      return String(t.wedge);
    case "anyDouble":
      return "ANY DOUBLE";
    case "anyTreble":
      return "ANY TREBLE";
    case "bull":
      return "BULL";
  }
}

/** Does this dart count for this round, and if so for how much? */
export function scoreFor(dart: Dart, target: HalveItTarget): number {
  if (dart.ring === "miss") return 0;

  switch (target.kind) {
    case "number":
      return "wedge" in dart && dart.wedge === target.wedge ? points(dart) : 0;
    case "anyDouble":
      // The inner bull is the double bull, so it counts.
      return dart.ring === "double" || dart.ring === "innerBull" ? points(dart) : 0;
    case "anyTreble":
      return dart.ring === "treble" ? points(dart) : 0;
    case "bull":
      return dart.ring === "innerBull" || dart.ring === "outerBull" ? points(dart) : 0;
  }
}

export interface HalveItState extends CommonState {
  readonly kind: "halveIt";
  readonly config: ConfigOf<"halveIt">;
  /** Points banked this visit. If a visit ends on zero, the score halves. */
  readonly scoredThisVisit: number;
}

const STARTING_SCORE = 40;

export const halveItEngine: GameEngine<ConfigOf<"halveIt">, HalveItState> = {
  kind: "halveIt",
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): HalveItState {
    return {
      // Starting on 40 gives the halving something to bite on in round one.
      ...initCommon(players, STARTING_SCORE),
      kind: "halveIt",
      config,
      scoredThisVisit: 0,
    };
  },

  step(state, dart): StepResult<HalveItState> {
    const seat = state.visit.seat;
    const target = HALVE_IT_ROUNDS[state.round];
    if (target === undefined) {
      return { state, events: [{ type: "dartMissed", seat, dart }] };
    }

    const scored = scoreFor(dart, target);
    const isLastDart = state.visit.darts.length === 2;
    const blanked = scored === 0 && state.scoredThisVisit === 0 && isLastDart;

    const events: GameEvent[] = [];
    let scores = state.scores;

    if (scored > 0) {
      scores = scores.map((v, i) => (i === seat ? v + scored : v));
      events.push({ type: "dartScored", seat, dart, points: scored });
    } else {
      events.push({ type: "dartMissed", seat, dart });
    }

    if (blanked) {
      // Nothing at all this visit. Halve it.
      const halved = Math.floor((state.scores[seat] ?? 0) / 2);
      scores = state.scores.map((v, i) => (i === seat ? halved : v));
      events.push({ type: "bust", seat, restoredTo: halved });
    }

    let next: HalveItState = {
      ...state,
      scores,
      scoredThisVisit: isLastDart ? 0 : state.scoredThisVisit + scored,
    };

    // Last dart of the last round for the last seat in: high score takes it.
    const lastSeat = next.active.lastIndexOf(true);
    if (state.round >= HALVE_IT_ROUNDS.length - 1 && seat === lastSeat && isLastDart) {
      const winner = next.scores.reduce(
        (best, v, i) => (next.active[i] === true && v > (next.scores[best] ?? 0) ? i : best),
        0,
      );
      next = { ...next, winner };
      events.push({ type: "won", seat: winner });
    }

    return { state: next, events };
  },

  aim(state): Bed {
    const target = HALVE_IT_ROUNDS[state.round] ?? HALVE_IT_ROUNDS[0];
    switch (target?.kind) {
      case "number":
        return { ring: "treble", wedge: target.wedge };
      case "anyDouble":
        return { ring: "double", wedge: 20 };
      case "anyTreble":
        return { ring: "treble", wedge: 20 };
      default:
        return { ring: "innerBull" };
    }
  },

  view(state): GameView {
    const seat = state.visit.seat;
    const target = HALVE_IT_ROUNDS[state.round];

    const players: PlayerView[] = state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: state.scores[i] ?? 0,
      isBot: p.sigma !== undefined,
      isActive: state.active[i] === true,
      isThrowing: i === seat && state.winner === null,
    }));

    return {
      kind: "halveIt",
      players,
      visit: {
        seat,
        darts: state.visit.darts,
        points: state.scoredThisVisit,
        dartsLeft: 3 - state.visit.darts.length,
      },
      round: state.round,
      winner: state.winner,
      panel: {
        kind: "halveIt",
        target: target ? describeTarget(target) : "-",
        round: state.round + 1,
        lastRound: HALVE_IT_ROUNDS.length,
        atRisk: state.scoredThisVisit === 0 && state.visit.darts.length > 0,
      },
    };
  },
};
