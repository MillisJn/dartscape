import { type Bed, bedAt, centreOf, type Dart, type Point } from "../board";

/**
 * The bot.
 *
 * A dart throw is a bivariate Gaussian around the point you aimed at. One
 * number — sigma, the standard deviation in millimetres — is the entire skill
 * model. (Tibshirani, Price & Taylor, "A Statistician Plays Darts", JRSS 2011.)
 *
 * Everything good falls out of that for free, because the board is modelled at
 * real size: miss T20 sideways and you land in 1 or 5, because that is genuinely
 * where they are. Miss high and you get S20. Nobody has to write a table of
 * "wrong numbers" or tune a fudge factor for it.
 *
 * This module knows nothing about any game. It is handed a bed to aim at — the
 * engines decide that, since it's strategy — and returns where the dart landed.
 * The old `GameBot` owned a `Handler`, read `GameData`, branched on the game
 * mode and called back into `GameLogic.doScore`; this one is a function.
 */

/** Uniform in [0, 1). Injected so every test is deterministic. */
export type Rng = () => number;

/**
 * A seeded generator (mulberry32). Small, fast, and good enough to simulate
 * darts — we need repeatability, not cryptography.
 */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One draw from a standard normal, via Box-Muller. */
export function gaussian(rng: Rng): number {
  // Guard against log(0).
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Where a dart aimed at `point` with accuracy `sigma` actually lands. */
export const scatter = (point: Point, sigma: number, rng: Rng): Point => ({
  x: point.x + gaussian(rng) * sigma,
  y: point.y + gaussian(rng) * sigma,
});

/** Throw one dart at a bed. This is the whole bot. */
export const throwAt = (target: Bed, sigma: number, rng: Rng): Dart =>
  bedAt(scatter(centreOf(target), sigma, rng));

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

/**
 * Named difficulties, as throwing sigma in millimetres. Lower is better.
 *
 * These are *measured*, not guessed — `npm run sim -- --curve` prints the 3-dart
 * average each tier actually plays to, and the table is set from that against
 * real darts benchmarks:
 *
 *   PERFECT  ~178   nine-darter territory
 *   MASTER   ~100   professional
 *   EXPERT    ~85   very strong club player
 *   HARDER    ~70   good club player
 *   HARD      ~59   solid league player
 *   MEDIUM    ~51   average league player
 *   NORMAL    ~46
 *   EASY      ~42
 *   NOVICE    ~37
 *   BEGINNER  ~31   pub player
 *
 * Note how compressed the low end is: even a wild dart hits *something*, so
 * sigma has to get very large before the average really collapses. That is
 * true of real beginners too.
 */
export const SKILL = {
  BEGINNER: 65,
  NOVICE: 45,
  EASY: 33,
  NORMAL: 26,
  MEDIUM: 21,
  HARD: 17,
  HARDER: 14,
  EXPERT: 11,
  MASTER: 8,
  PERFECT: 1,
} as const satisfies Record<string, number>;

export type SkillName = keyof typeof SKILL;

export const SKILL_NAMES = Object.keys(SKILL) as readonly SkillName[];

/** The name for a sigma — the nearest tier at or below this accuracy. */
export function skillName(sigma: number): SkillName {
  let best: SkillName = "BEGINNER";
  for (const name of SKILL_NAMES) {
    if (sigma <= SKILL[name]) best = name;
  }
  return best;
}

/**
 * Points per dart against a fixed target, measured rather than modelled.
 *
 * There is no closed form for this — the answer depends on the whole layout of
 * the board — so the honest way to know how hard a tier plays is to throw a lot
 * of darts and count. Used by the sim to sanity-check the curve.
 */
export function measurePpd(
  target: Bed,
  sigma: number,
  rng: Rng,
  darts = 10_000,
  score: (d: Dart) => number,
): number {
  let total = 0;
  for (let i = 0; i < darts; i++) total += score(throwAt(target, sigma, rng));
  return total / darts;
}
