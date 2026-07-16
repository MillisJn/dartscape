import type { Dart, Wedge } from "../board";

/**
 * What just happened, as data.
 *
 * The old app pushed this through a 12-method `GameLogicListener` that the game
 * fragment implemented, which is how UI concerns ended up inside `GameLogic`.
 * Here `step()` returns events and the core never learns a UI exists. Every sound,
 * popup and animation in Phase 2 hangs off one of these.
 *
 * Events describe *transitions*, not state. Anything that is a fact about the
 * world right now belongs in `GameView` instead.
 */

/** A cricket-style target: a numbered wedge, or the bull. */
export type Target = Wedge | "bull";

export type GameEvent =
  // --- universal ---
  | {
      readonly type: "dartScored";
      readonly seat: number;
      readonly dart: Dart;
      readonly points: number;
    }
  | { readonly type: "dartMissed"; readonly seat: number; readonly dart: Dart }
  | { readonly type: "visitEnded"; readonly seat: number; readonly next: number }
  | { readonly type: "roundEnded"; readonly round: number }
  | { readonly type: "won"; readonly seat: number }

  // --- x01 ---
  | { readonly type: "bust"; readonly seat: number; readonly restoredTo: number }
  /** Scored before opening — the dart counts as thrown but not as points. */
  | { readonly type: "notOpenedYet"; readonly seat: number; readonly dart: Dart }
  | { readonly type: "opened"; readonly seat: number }
  | {
      readonly type: "checkout";
      readonly seat: number;
      readonly points: number;
      readonly darts: number;
    }

  // --- cricket ---
  | {
      readonly type: "marked";
      readonly seat: number;
      readonly target: Target;
      readonly marks: number;
    }
  | { readonly type: "targetClosed"; readonly seat: number; readonly target: Target }
  /** Every player has now closed it — nobody can score on it any more. */
  | { readonly type: "targetDead"; readonly target: Target }

  // --- shanghai ---
  | { readonly type: "shanghai"; readonly seat: number; readonly target: Target }

  // --- baseball ---
  | {
      readonly type: "baseHit";
      readonly seat: number;
      readonly bases: number;
      readonly runs: number;
    }
  | { readonly type: "homeRun"; readonly seat: number; readonly runs: number }
  | { readonly type: "grandSlam"; readonly seat: number }
  | { readonly type: "out"; readonly seat: number; readonly outs: number }
  | { readonly type: "inningEnded"; readonly inning: number }

  // --- killer ---
  | { readonly type: "numberClaimed"; readonly seat: number; readonly target: Target }
  | { readonly type: "becameKiller"; readonly seat: number }
  | { readonly type: "lostKillerStatus"; readonly seat: number }
  | {
      readonly type: "lifeLost";
      readonly seat: number;
      readonly by: number;
      readonly livesLeft: number;
    }
  | { readonly type: "eliminated"; readonly seat: number };

export type GameEventType = GameEvent["type"];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
