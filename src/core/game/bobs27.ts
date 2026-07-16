import type { Bed, Dart, Wedge } from "../board";
import type { ConfigOf, Player } from "./config";
import {
  type CommonState,
  type GameEngine,
  initCommon,
  type StepResult,
  THREE_DARTS,
} from "./engine";
import type { GameEvent, Target } from "./events";
import type { GameView, PlayerView } from "./view";

/**
 * Bob's 27 — Bob Anderson's doubles trainer, and the best one there is.
 *
 * Start on 27. Round one is D1: every hit is worth +2, but blank all three
 * darts and you lose 2. Round two is D2 at +/-4. On through D20 and then the
 * bull at +/-50. Drop below zero and you're out.
 *
 * The maths is brutal on purpose — the doubles get more valuable exactly as the
 * pressure of your dwindling score gets worse, so it trains the thing that
 * actually loses legs.
 */

export const BOBS_27_START = 27;

/** D1 through D20, then the bull. */
export const BOBS_27_ROUNDS: readonly Target[] = [
  ...Array.from({ length: 20 }, (_, i) => (i + 1) as Wedge),
  "bull",
];

/** What one hit on this round is worth. The bull is the double bull: 50. */
export function valueOfRound(target: Target): number {
  return target === "bull" ? 50 : target * 2;
}

/** Does this dart count? Doubles only — the bull means the inner bull. */
export function hits(dart: Dart, target: Target): boolean {
  if (target === "bull") return dart.ring === "innerBull";
  return dart.ring === "double" && dart.wedge === target;
}

export interface Bobs27State extends CommonState {
  readonly kind: "bobs27";
  readonly config: ConfigOf<"bobs27">;
  /** Hits on this round's double so far this visit, 0-3. */
  readonly hitsThisVisit: number;
}

export const bobs27Engine: GameEngine<ConfigOf<"bobs27">, Bobs27State> = {
  kind: "bobs27",
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): Bobs27State {
    return {
      ...initCommon(players, BOBS_27_START),
      kind: "bobs27",
      config,
      hitsThisVisit: 0,
    };
  },

  step(state, dart): StepResult<Bobs27State> {
    const seat = state.visit.seat;
    const target = BOBS_27_ROUNDS[state.round];
    if (target === undefined) {
      return { state, events: [{ type: "dartMissed", seat, dart }] };
    }

    const value = valueOfRound(target);
    const hit = hits(dart, target);
    const isLastDart = state.visit.darts.length === 2;
    const hitCount = state.hitsThisVisit + (hit ? 1 : 0);

    const events: GameEvent[] = [];
    let scores = state.scores;

    if (hit) {
      scores = scores.map((v, i) => (i === seat ? v + value : v));
      events.push({ type: "dartScored", seat, dart, points: value });
    } else {
      events.push({ type: "dartMissed", seat, dart });
    }

    // Blanked the whole visit: pay the forfeit.
    if (isLastDart && hitCount === 0) {
      scores = scores.map((v, i) => (i === seat ? v - value : v));
      events.push({ type: "bust", seat, restoredTo: scores[seat] ?? 0 });
    }

    let next: Bobs27State = {
      ...state,
      scores,
      hitsThisVisit: isLastDart ? 0 : hitCount,
    };

    // Below zero and you're out. That's the whole tension of the game.
    if (isLastDart && (next.scores[seat] ?? 0) < 0) {
      const active = next.active.map((a, i) => (i === seat ? false : a));
      next = { ...next, active };
      events.push({ type: "eliminated", seat });
    }

    const survivors = next.active.filter(Boolean).length;
    const lastSeat = next.active.lastIndexOf(true);
    const finished = state.round >= BOBS_27_ROUNDS.length - 1 && isLastDart;

    // Everyone out, or the last double of the last round has been thrown.
    if (survivors === 0) {
      // Nobody survived — whoever got furthest takes it.
      const best = next.scores.reduce((b, v, i) => (v > (next.scores[b] ?? 0) ? i : b), 0);
      next = { ...next, winner: best };
      events.push({ type: "won", seat: best });
    } else if (survivors === 1 && next.players.length > 1) {
      const winner = next.active.indexOf(true);
      next = { ...next, winner };
      events.push({ type: "won", seat: winner });
    } else if (finished && (seat === lastSeat || lastSeat === -1)) {
      const best = next.scores.reduce(
        (b, v, i) => (next.active[i] === true && v > (next.scores[b] ?? 0) ? i : b),
        0,
      );
      next = { ...next, winner: best };
      events.push({ type: "won", seat: best });
    }

    return { state: next, events };
  },

  aim(state): Bed {
    const target = BOBS_27_ROUNDS[state.round] ?? 1;
    return target === "bull" ? { ring: "innerBull" } : { ring: "double", wedge: target };
  },

  view(state): GameView {
    const seat = state.visit.seat;
    const target = BOBS_27_ROUNDS[state.round] ?? 1;

    const players: PlayerView[] = state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: state.scores[i] ?? 0,
      isBot: p.sigma !== undefined,
      isActive: state.active[i] === true,
      isThrowing: i === seat && state.winner === null,
    }));

    return {
      kind: "bobs27",
      players,
      visit: {
        seat,
        darts: state.visit.darts,
        points: 0,
        dartsLeft: 3 - state.visit.darts.length,
      },
      round: state.round,
      winner: state.winner,
      panel: {
        kind: "bobs27",
        target,
        round: state.round + 1,
        lastRound: BOBS_27_ROUNDS.length,
        hits: state.hitsThisVisit,
      },
    };
  },
};
