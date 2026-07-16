import { type Bed, type Dart, isMiss, points, SIGMA_T19_CROSSOVER } from "../board";
import { bestCheckout, minFinish, openingAim, satisfies } from "./checkout";
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
 * X01 — 301 through 1501, any in/out rule.
 *
 * A leg is a subtraction problem with two traps: you must open legally, and you
 * must land on exactly zero with a legal finishing dart. Everything else is a
 * bust, which puts you back where the visit started.
 */

export interface X01State extends CommonState {
  readonly kind: "x01";
  readonly config: ConfigOf<"x01">;
  /** Seat-indexed. Has this player satisfied the in-rule yet? */
  readonly opened: readonly boolean[];
}

const T20: Bed = { ring: "treble", wedge: 20 };
const T19: Bed = { ring: "treble", wedge: 19 };

/**
 * Good throwers go for the 20. Weaker ones genuinely score more on the 19, and
 * the threshold is the board's, not ours — see SIGMA_T19_CROSSOVER.
 *
 * Humans always get the 20: we can't measure their sigma, and telling a player
 * to stop aiming at treble twenty would be a strange thing for a scoreboard
 * to do.
 */
function scoringAim(sigma: number | undefined): Bed {
  return sigma !== undefined && sigma > SIGMA_T19_CROSSOVER ? T19 : T20;
}

export const x01Engine: GameEngine<ConfigOf<"x01">, X01State> = {
  kind: "x01",
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): X01State {
    return {
      ...initCommon(players, config.start),
      kind: "x01",
      config,
      // Straight-in has nothing to satisfy, so everyone starts open.
      opened: players.map(() => config.in === "straight"),
    };
  },

  step(state, dart): StepResult<X01State> {
    const seat = state.visit.seat;
    const { config } = state;

    if (isMiss(dart)) {
      return { state, events: [{ type: "dartMissed", seat, dart }] };
    }

    const events: GameEvent[] = [];
    let opened = state.opened;

    if (state.opened[seat] !== true) {
      if (!satisfies(config.in, dart)) {
        // Thrown and counted as a dart, but it buys nothing.
        return { state, events: [{ type: "notOpenedYet", seat, dart }] };
      }
      opened = state.opened.map((o, i) => (i === seat ? true : o));
      events.push({ type: "opened", seat });
    }

    const scored = points(dart);
    const before = state.scores[seat] ?? 0;
    const remaining = before - scored;

    const bust =
      remaining < 0 ||
      (remaining > 0 && remaining < minFinish(config.out)) ||
      (remaining === 0 && !satisfies(config.out, dart));

    if (bust) {
      const restoredTo = state.visit.scoresAtVisitStart[seat] ?? before;
      return {
        state: { ...state, opened, scores: state.visit.scoresAtVisitStart },
        events: [...events, { type: "bust", seat, restoredTo }],
        endVisit: true,
      };
    }

    const scores = state.scores.map((s, i) => (i === seat ? remaining : s));
    events.push({ type: "dartScored", seat, dart, points: scored });

    if (remaining > 0) {
      return { state: { ...state, opened, scores }, events };
    }

    // Checked out.
    const dartsUsed = state.visit.darts.length + 1;
    const visitPoints = state.visit.darts.reduce((sum, d) => sum + points(d), 0) + scored;

    events.push(
      { type: "checkout", seat, points: visitPoints, darts: dartsUsed },
      { type: "won", seat },
    );

    return { state: { ...state, opened, scores, winner: seat }, events };
  },

  aim(state): Bed {
    const seat = state.visit.seat;
    const sigma = state.players[seat]?.sigma;

    if (state.opened[seat] !== true) return openingAim(state.config.in);

    const score = state.scores[seat] ?? 0;
    const dartsLeft = 3 - state.visit.darts.length;
    const route = bestCheckout(score, state.config.out);

    // Only go for the finish if it actually fits in the darts left.
    if (route && route.length <= dartsLeft) return route[0] as Bed;

    // Otherwise set up: leave a score we can finish from next visit.
    return scoringAim(sigma);
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
      kind: "x01",
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
        kind: "x01",
        checkout: bestCheckout(state.scores[seat] ?? 0, state.config.out),
        opened: state.opened,
      },
    };
  },
};

/** Convenience for tests and the sim: score of a dart, as X01 counts it. */
export const x01Points = (d: Dart): number => points(d);
