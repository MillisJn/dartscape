import type { Wedge } from "../board";

/**
 * What game is being played, and by whom.
 *
 * The old app expressed this as a 30-value `GameFlag` enum plus a `GameFlagSet`,
 * with display names looked up *by enum ordinal* and validity spread across
 * `getGames()` / `getGameModes()` / `getGameVariants(flag, statsFlags, secondary)`.
 * Here the union is the validity matrix: you cannot build a cricket game with a
 * shanghai start number, and the compiler enforces it. Display names live in the
 * UI and are never keyed by position.
 */

export interface Player {
  readonly id: string;
  readonly name: string;
  /**
   * Bot skill, as throwing accuracy sigma in millimetres. Absent = human.
   * Lower is better: a professional is around 17mm, a casual player around 40mm.
   */
  readonly sigma?: number;
}

export const isBot = (p: Player): boolean => p.sigma !== undefined;

/** How a player must open (in) or finish (out) an X01 leg. */
export type InOutRule = "straight" | "double" | "treble" | "master";

export type X01Start = 301 | 501 | 701 | 901 | 1001 | 1201 | 1501;

/** How cricket points behave once a number is closed. */
export type CricketScoring = "points" | "cutThroat" | "noPoints";

/** What a dart must find to count in Around the Clock. */
export type ClockRing = "any" | "double" | "treble";

export type GameConfig =
  | {
      readonly kind: "x01";
      readonly start: X01Start;
      readonly in: InOutRule;
      readonly out: InOutRule;
    }
  | { readonly kind: "cricket"; readonly scoring: CricketScoring }
  | { readonly kind: "shanghai"; readonly from: Wedge; readonly to: Wedge }
  | { readonly kind: "baseball"; readonly innings: number }
  | {
      readonly kind: "killer";
      readonly lives: number;
      /** Standard killer is played on doubles. 'single' is the old app's variant. */
      readonly target: "double" | "single";
      /** When true, only one player holds killer status at a time. */
      readonly oneKiller: boolean;
    }
  | {
      /** Race 1 through 20 in order. The classic. */
      readonly kind: "aroundTheClock";
      readonly ring: ClockRing;
      readonly includeBull: boolean;
    }
  | {
      /** Seven targets; blank a round and your score is halved. */
      readonly kind: "halveIt";
    }
  | {
      /** Bob Anderson's doubles trainer: D1..D20, DBull. Below zero and you're out. */
      readonly kind: "bobs27";
    };

export type GameKind = GameConfig["kind"];
export type ConfigOf<K extends GameKind> = Extract<GameConfig, { kind: K }>;

export const GAME_KINDS = [
  "x01",
  "cricket",
  "shanghai",
  "baseball",
  "killer",
  "aroundTheClock",
  "halveIt",
  "bobs27",
] as const satisfies readonly GameKind[];

/** Sensible starting point for each game, for a new-game screen. */
export const DEFAULT_CONFIG: { readonly [K in GameKind]: ConfigOf<K> } = {
  x01: { kind: "x01", start: 501, in: "straight", out: "double" },
  cricket: { kind: "cricket", scoring: "points" },
  shanghai: { kind: "shanghai", from: 1, to: 7 },
  baseball: { kind: "baseball", innings: 9 },
  killer: { kind: "killer", lives: 3, target: "double", oneKiller: false },
  aroundTheClock: { kind: "aroundTheClock", ring: "any", includeBull: false },
  halveIt: { kind: "halveIt" },
  bobs27: { kind: "bobs27" },
};
