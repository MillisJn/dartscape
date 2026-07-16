import { type Bed, BULL_TARGET, type Dart, type Wedge } from "../board";
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
 * Around the Clock — race from 1 to 20 in order, optionally finishing on the
 * bull. Hit your number and you move on; miss and you throw at it again.
 *
 * The purest race on the board, and the first game most people ever learn. The
 * `ring` option is what turns it from a warm-up into a real test: doubles-only
 * around the clock is genuinely hard.
 */

export interface AroundTheClockState extends CommonState {
  readonly kind: "aroundTheClock";
  readonly config: ConfigOf<"aroundTheClock">;
  /**
   * How far each seat has got, as an index into the sequence. Equal to the
   * sequence length means they're home. Kept per seat rather than as `scores`
   * so the score can stay "numbers cleared", which is what a scoreboard wants.
   */
  readonly at: readonly number[];
}

/** 1..20, then the bull if it's in. */
export function sequenceOf(config: ConfigOf<"aroundTheClock">): readonly Target[] {
  const numbers = Array.from({ length: 20 }, (_, i) => (i + 1) as Wedge);
  return config.includeBull ? [...numbers, BULL_TARGET] : numbers;
}

/** Does this dart clear `target` under the configured ring rule? */
export function clears(
  dart: Dart,
  target: Target,
  ring: ConfigOf<"aroundTheClock">["ring"],
): boolean {
  if (dart.ring === "miss") return false;

  if (target === "bull") {
    // The inner bull is the bull's double; the outer is its single.
    if (ring === "treble") return false;
    if (ring === "double") return dart.ring === "innerBull";
    return dart.ring === "innerBull" || dart.ring === "outerBull";
  }

  if (!("wedge" in dart) || dart.wedge !== target) return false;
  if (ring === "any") return true;
  return dart.ring === ring;
}

export const aroundTheClockEngine: GameEngine<ConfigOf<"aroundTheClock">, AroundTheClockState> = {
  kind: "aroundTheClock",
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): AroundTheClockState {
    return {
      ...initCommon(players, 0),
      kind: "aroundTheClock",
      config,
      at: players.map(() => 0),
    };
  },

  step(state, dart): StepResult<AroundTheClockState> {
    const seat = state.visit.seat;
    const sequence = sequenceOf(state.config);
    const index = state.at[seat] ?? 0;
    const target = sequence[index];

    if (target === undefined || !clears(dart, target, state.config.ring)) {
      return { state, events: [{ type: "dartMissed", seat, dart }] };
    }

    const next = index + 1;
    const at = state.at.map((v, i) => (i === seat ? next : v));
    // Score is "numbers cleared" — the honest thing to put on a scoreboard.
    const scores = state.scores.map((v, i) => (i === seat ? next : v));

    const events: GameEvent[] = [{ type: "dartScored", seat, dart, points: 1 }];
    const home = next >= sequence.length;
    if (home) events.push({ type: "won", seat });

    return {
      state: { ...state, at, scores, winner: home ? seat : state.winner },
      events,
    };
  },

  aim(state): Bed {
    const sequence = sequenceOf(state.config);
    const target = sequence[state.at[state.visit.seat] ?? 0];
    if (target === undefined || target === "bull") {
      return state.config.ring === "double" ? { ring: "innerBull" } : { ring: "outerBull" };
    }
    const ring = state.config.ring === "any" ? "single" : state.config.ring;
    return { ring, wedge: target };
  },

  view(state): GameView {
    const seat = state.visit.seat;
    const sequence = sequenceOf(state.config);

    const players: PlayerView[] = state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: state.scores[i] ?? 0,
      isBot: p.sigma !== undefined,
      isActive: state.active[i] === true,
      isThrowing: i === seat && state.winner === null,
    }));

    return {
      kind: "aroundTheClock",
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
        kind: "aroundTheClock",
        on: state.players.map((_, i) => sequence[state.at[i] ?? 0] ?? null),
        ring: state.config.ring,
      },
    };
  },
};
