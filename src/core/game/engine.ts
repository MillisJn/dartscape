import type { Bed, Dart } from "../board";
import type { GameConfig, Player } from "./config";
import type { GameEvent } from "./events";
import type { GameView } from "./view";

/**
 * The contract every game implements, and the visit machinery they share.
 *
 * The old app repeated visit handling inside each game's branch of
 * `GameLogic.doScore`, with `isBaseball()` / `isKiller()` checks sprinkled
 * through it. Here it is written once, and the one game that genuinely differs
 * (baseball ends a visit on three *outs*, not three darts) says so by declaring
 * a policy rather than by the shared code special-casing it.
 */

/** The visit in progress: one player, up to three darts. */
export interface VisitState {
  readonly seat: number;
  /** Darts thrown so far this visit. */
  readonly darts: readonly Dart[];
  /** Scores as they were before this visit — what a bust restores to. */
  readonly scoresAtVisitStart: readonly number[];
}

/** The parts of game state that every game has. */
export interface CommonState {
  readonly players: readonly Player[];
  /** Seat-indexed. Meaning is per-game: remaining in X01, points in cricket, lives in killer. */
  readonly scores: readonly number[];
  /** Seat-indexed. False once knocked out — only killer does this today. */
  readonly active: readonly boolean[];
  readonly visit: VisitState;
  /** Completed rounds. Increments when the visit wraps back to the first seat. */
  readonly round: number;
  readonly winner: number | null;
}

/** When a visit ends. */
export type VisitPolicy =
  | { readonly kind: "darts"; readonly count: number }
  /** The engine decides — it returns `endVisit` from `step`. */
  | { readonly kind: "engine" };

export const THREE_DARTS: VisitPolicy = { kind: "darts", count: 3 };

export interface StepResult<S extends CommonState> {
  readonly state: S;
  readonly events: readonly GameEvent[];
  /** End the visit now regardless of darts thrown — a bust, or three outs. */
  readonly endVisit?: boolean;
}

export interface GameEngine<C extends GameConfig, S extends CommonState> {
  readonly kind: C["kind"];
  readonly visitPolicy: VisitPolicy;

  init(config: C, players: readonly Player[]): S;

  /**
   * Apply one dart's effect. Pure.
   *
   * `state.visit.darts` does *not* yet include `dart` — this dart is the one
   * being thrown. Engines that care about the whole visit (shanghai wants a
   * single, double and treble together) should read `[...state.visit.darts, dart]`.
   *
   * Recording the dart into the visit and cycling seats is the caller's job.
   */
  step(state: S, dart: Dart): StepResult<S>;

  /** Where a bot should aim from here. Keeps strategy inside the game. */
  aim(state: S): Bed;

  /** Pure projection for the UI. */
  view(state: S): GameView;
}

// ---------------------------------------------------------------------------
// Shared visit machinery
// ---------------------------------------------------------------------------

export const seatsInPlay = (s: CommonState): number => s.active.filter(Boolean).length;

/** The next seat still in the game, wrapping. Returns `from` if nobody else is left. */
export function nextSeat(s: CommonState, from: number): number {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    if (s.active[seat] === true) return seat;
  }
  return from;
}

export const isVisitOver = (s: CommonState, policy: VisitPolicy): boolean =>
  policy.kind === "darts" && s.visit.darts.length >= policy.count;

/** Record a dart into the current visit, without ending it. */
export function recordDart<S extends CommonState>(state: S, dart: Dart): S {
  return {
    ...state,
    visit: { ...state.visit, darts: [...state.visit.darts, dart] },
  };
}

/**
 * Hand the visit to the next seat. Emits `visitEnded`, and `roundEnded` when
 * play wraps back round to the first seat still in.
 */
export function endVisit<S extends CommonState>(
  state: S,
): { state: S; events: readonly GameEvent[] } {
  const from = state.visit.seat;
  const next = nextSeat(state, from);
  const events: GameEvent[] = [{ type: "visitEnded", seat: from, next }];

  // A round completes when the visit wraps past the last seat in play.
  const wrapped = next <= from;
  const round = wrapped ? state.round + 1 : state.round;
  if (wrapped) events.push({ type: "roundEnded", round });

  return {
    state: {
      ...state,
      round,
      visit: { seat: next, darts: [], scoresAtVisitStart: state.scores },
    },
    events,
  };
}

/** Starting common state for a fresh game. */
export function initCommon(players: readonly Player[], startScore: number): CommonState {
  const scores = players.map(() => startScore);
  return {
    players,
    scores,
    active: players.map(() => true),
    visit: { seat: 0, darts: [], scoresAtVisitStart: scores },
    round: 0,
    winner: null,
  };
}

/**
 * One dart, with everything that was true when it was thrown.
 *
 * Stats live off this. It's why checkout % is possible for us and impossible
 * for the old app: knowing a dart was thrown at a double means knowing the
 * score the thrower was sitting on at the time, and only the fold knows that.
 */
export interface DartRecord {
  readonly dart: Dart;
  readonly seat: number;
  /** Position in the whole game, from 0. */
  readonly index: number;
  /** Position within the visit: 0, 1 or 2. */
  readonly inVisit: number;
  /** The thrower's score before and after this dart. */
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly events: readonly GameEvent[];
}

/**
 * Fold a log of darts into state, using one engine. This is the whole of
 * `reduce` for a single game kind; `registry.ts` dispatches to it by config.
 *
 * Only the events from the final dart are returned — those are "what just
 * happened". Everything earlier is already baked into the state.
 */
export function runLog<C extends GameConfig, S extends CommonState>(
  engine: GameEngine<C, S>,
  config: C,
  players: readonly Player[],
  log: readonly Dart[],
): { state: S; events: readonly GameEvent[]; trace: readonly DartRecord[] } {
  let state = engine.init(config, players);
  let events: readonly GameEvent[] = [];
  const trace: DartRecord[] = [];

  for (const [index, dart] of log.entries()) {
    if (state.winner !== null) break;

    const seat = state.visit.seat;
    const inVisit = state.visit.darts.length;
    const scoreBefore = state.scores[seat] ?? 0;

    const result = engine.step(state, dart);
    state = recordDart(result.state, dart);
    events = result.events;

    trace.push({
      dart,
      seat,
      index,
      inVisit,
      scoreBefore,
      scoreAfter: state.scores[seat] ?? 0,
      events,
    });

    const done =
      state.winner !== null || result.endVisit === true || isVisitOver(state, engine.visitPolicy);

    if (done && state.winner === null) {
      const ended = endVisit(state);
      state = ended.state;
      events = [...events, ...ended.events];
    }
  }

  return { state, events, trace };
}
