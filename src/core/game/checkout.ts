import { ALL_BEDS, type Bed, points } from "../board";
import type { InOutRule } from "./config";

/**
 * Checkout routes, derived from the board.
 *
 * The old `X01Logic` hardcodes three tables of possible outs and a table of
 * possible scores, then brute-forces two nested loops over them. Those tables
 * are the board — so we generate them from it instead. No magic numbers, every
 * in/out rule works for free, and adding a rule needs no new table.
 */

/** Can a leg be opened (or finished) on this bed under this rule? */
export function satisfies(rule: InOutRule, b: Bed): boolean {
  switch (rule) {
    case "straight":
      return true;
    case "double":
      // The inner bull is the double bull — it counts as a double.
      return b.ring === "double" || b.ring === "innerBull";
    case "treble":
      return b.ring === "treble";
    case "master":
      return b.ring === "double" || b.ring === "treble" || b.ring === "innerBull";
  }
}

/**
 * The lowest score you can still finish from. Leaving less than this is a bust:
 * with double-out you cannot finish from 1, because there is no D0.5.
 */
export function minFinish(rule: InOutRule): number {
  switch (rule) {
    case "straight":
      return 1;
    case "treble":
      return 3;
    case "double":
    case "master":
      return 2;
  }
}

/**
 * Preferred order to finish on. Players like doubles that halve cleanly if they
 * miss into the single — D16 leaves D8 leaves D4. D20 is the classic target,
 * D16 the pro's. The bull is a last resort; it is the smallest target on the
 * board.
 */
const FINISH_ORDER = [20, 16, 8, 4, 2, 1, 18, 12, 10, 6, 14, 19, 17, 15, 13, 11, 9, 7, 5, 3];

function finishBeds(rule: InOutRule): readonly Bed[] {
  const legal = ALL_BEDS.filter((b) => satisfies(rule, b));
  return [...legal].sort((a, b) => rank(a) - rank(b));
}

function rank(b: Bed): number {
  if (b.ring === "innerBull") return 100;
  if (b.ring === "outerBull") return 101;
  const preference = FINISH_ORDER.indexOf(b.wedge);
  const ringBias = b.ring === "double" ? 0 : 50;
  return ringBias + (preference === -1 ? 40 : preference);
}

/**
 * Setup darts, best first. Trebles of the big numbers, then everything else by
 * value — you want to leave a finish, and you want to get there fast.
 */
const SETUP_BEDS: readonly Bed[] = [...ALL_BEDS].sort((a, b) => {
  const byPoints = points(b) - points(a);
  if (byPoints !== 0) return byPoints;
  // Same value: a single is an easier target than a double or treble.
  const ease = (x: Bed) => (x.ring === "single" ? 0 : x.ring === "double" ? 1 : 2);
  return ease(a) - ease(b);
});

/** Any bed worth exactly this many points — easiest target first. */
function bedWorth(pts: number): Bed | undefined {
  return SETUP_BEDS.find((b) => points(b) === pts);
}

function finishWorth(pts: number, rule: InOutRule): Bed | undefined {
  return finishBeds(rule).find((b) => points(b) === pts);
}

/** The highest score finishable with three darts under a rule. */
export function maxCheckout(rule: InOutRule): number {
  const best = Math.max(...SETUP_BEDS.map(points));
  const bestFinish = Math.max(...finishBeds(rule).map(points));
  return best * 2 + bestFinish;
}

/**
 * A route to zero in three darts or fewer, or null if there isn't one.
 *
 * Searches shortest-first, and within that prefers leaving a friendly double —
 * so 100 comes back as T20, D20 rather than 20, D40-that-doesn't-exist, and
 * 170 comes back as the big fish: T20, T20, BULL.
 */
export function bestCheckout(score: number, rule: InOutRule): readonly Bed[] | null {
  if (score <= 0 || score > maxCheckout(rule)) return null;

  // One dart.
  const one = finishWorth(score, rule);
  if (one) return [one];

  const finishes = finishBeds(rule);

  // Two darts: pick the finish first so we land on a good double.
  for (const finish of finishes) {
    const setup = score - points(finish);
    if (setup <= 0) continue;
    const bed = bedWorth(setup);
    if (bed) return [bed, finish];
  }

  // Three darts.
  for (const finish of finishes) {
    const remaining = score - points(finish);
    if (remaining <= 0) continue;
    for (const first of SETUP_BEDS) {
      const left = remaining - points(first);
      if (left <= 0) continue;
      const second = bedWorth(left);
      if (second) return [first, second, finish];
    }
  }

  return null;
}

/**
 * True if this score cannot be left behind — you'd have no legal finish.
 * Anything below the minimum, and (for double/master) an odd 1.
 */
export const isBustLeave = (score: number, rule: InOutRule): boolean =>
  score > 0 && score < minFinish(rule);

/** Where to aim to open a leg. */
export function openingAim(rule: InOutRule): Bed {
  switch (rule) {
    case "straight":
      return { ring: "treble", wedge: 20 };
    case "double":
      return { ring: "double", wedge: 20 };
    case "treble":
    case "master":
      return { ring: "treble", wedge: 20 };
  }
}
