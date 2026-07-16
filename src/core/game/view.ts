import type { Bed, Dart } from "../board";
import type { GameKind } from "./config";
import type { Target } from "./events";

/**
 * The read model: everything a screen needs to draw any of the five games,
 * and nothing else.
 *
 * This is deliberately the *cheap* layer. Engine state is authoritative and
 * `view()` is a pure projection over it, so if Phase 2 wants a field we didn't
 * imagine, we add it here and touch nothing else. That is the pressure valve
 * that stops the UI from ever forcing a change to the engines.
 */

export interface PlayerView {
  readonly seat: number;
  readonly name: string;
  readonly score: number;
  readonly isBot: boolean;
  /** False once knocked out — only killer does this today. */
  readonly isActive: boolean;
  readonly isThrowing: boolean;
}

export interface VisitView {
  readonly seat: number;
  readonly darts: readonly Dart[];
  /** Points scored so far this visit. */
  readonly points: number;
  readonly dartsLeft: number;
}

/** One row of a cricket sheet: a target, and each seat's marks on it. */
export interface CricketRow {
  readonly target: Target;
  /** Marks per seat, capped at 3 (closed). */
  readonly marks: readonly number[];
  /** Closed by everyone — no longer scorable. */
  readonly dead: boolean;
}

export interface KillerSeatView {
  /** The number this seat claimed, or null while still claiming. */
  readonly target: Target | null;
  readonly lives: number;
  readonly isKiller: boolean;
}

export type PanelView =
  | {
      readonly kind: "x01";
      /** Suggested finish from here, best first. Null if not on a checkout. */
      readonly checkout: readonly Bed[] | null;
      /** Per seat: has this player opened yet? Always true for straight-in. */
      readonly opened: readonly boolean[];
    }
  | { readonly kind: "cricket"; readonly rows: readonly CricketRow[] }
  | {
      readonly kind: "shanghai";
      readonly target: Target;
      readonly round: number;
      readonly lastRound: number;
    }
  | {
      readonly kind: "baseball";
      readonly inning: number;
      readonly innings: number;
      readonly outs: number;
      /** Index 0 is the hitter; 1-3 are first, second and third. */
      readonly bases: readonly boolean[];
      /** Runs the throwing seat has scored this inning. */
      readonly runs: number;
      readonly baseHits: number;
    }
  | {
      readonly kind: "killer";
      readonly phase: "claim" | "kill";
      readonly seats: readonly KillerSeatView[];
    }
  | {
      readonly kind: "aroundTheClock";
      /** The number each seat is currently chasing. */
      readonly on: readonly (Target | null)[];
      readonly ring: "any" | "double" | "treble";
    }
  | {
      readonly kind: "halveIt";
      readonly target: string;
      readonly round: number;
      readonly lastRound: number;
      /** Nothing hit yet this visit — blank it and the score halves. */
      readonly atRisk: boolean;
    }
  | {
      readonly kind: "bobs27";
      readonly target: Target;
      readonly round: number;
      readonly lastRound: number;
      /** Hits on this round's double so far, 0-3. */
      readonly hits: number;
    };

export interface GameView {
  readonly kind: GameKind;
  readonly players: readonly PlayerView[];
  readonly visit: VisitView;
  readonly round: number;
  readonly winner: number | null;
  readonly panel: PanelView;
}
