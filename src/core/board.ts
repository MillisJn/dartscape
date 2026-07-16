/**
 * The dartboard: what regions exist, what they score, and where they physically
 * are. This is the vocabulary every other module speaks.
 *
 * Pure TypeScript. Nothing here knows about any particular game — cricket's
 * numbers, X01's checkouts and baseball's innings all live with their engines.
 */

/** A numbered wedge of the board. */
// biome-ignore format: the board is 1-20; one line reads better than twenty
export type Wedge = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

/** The scoring regions a dart can find. */
export type Ring = "single" | "double" | "treble" | "outerBull" | "innerBull" | "miss";

/**
 * How games name the bull when they're talking about targets rather than beds —
 * "the 20" and "the bull" sit at the same level, but one is a wedge and the
 * other isn't.
 */
export const BULL_TARGET = "bull" as const;

/**
 * A "bed" is a single scoring region of the board. Modelled as a union rather
 * than a (number, multiplier) pair so that impossible beds — a treble bull, a
 * wedge 0 — cannot be constructed at all.
 */
export type Bed =
  | { readonly ring: "single" | "double" | "treble"; readonly wedge: Wedge }
  | { readonly ring: "outerBull" }
  | { readonly ring: "innerBull" };

/** A thrown dart: either it found a bed, or it found wire/wall/floor. */
export type Dart = Bed | { readonly ring: "miss" };

export const MISS = { ring: "miss" } as const satisfies Dart;
export const INNER_BULL = { ring: "innerBull" } as const satisfies Bed;
export const OUTER_BULL = { ring: "outerBull" } as const satisfies Bed;

export const bed = (ring: "single" | "double" | "treble", wedge: Wedge): Bed => ({
  ring,
  wedge,
});

/** Type guard: narrows a Dart to a Bed on the false branch. */
export const isMiss = (d: Dart): d is { readonly ring: "miss" } => d.ring === "miss";

/** Type guard: this dart actually found a scoring region. */
export const isBed = (d: Dart): d is Bed => d.ring !== "miss";

export const isBull = (d: Dart): boolean => d.ring === "innerBull" || d.ring === "outerBull";

/** Points this dart is worth. */
export function points(d: Dart): number {
  switch (d.ring) {
    case "miss":
      return 0;
    case "outerBull":
      return 25;
    case "innerBull":
      return 50;
    case "single":
      return d.wedge;
    case "double":
      return d.wedge * 2;
    case "treble":
      return d.wedge * 3;
  }
}

/**
 * How many marks this bed is worth on a cricket-style sheet — 1 for a single or
 * the outer bull, 2 for a double or the inner bull, 3 for a treble. Matches the
 * NDA league definition.
 *
 * Note this is marks *per bed*, not marks scored: whether the number is on the
 * sheet at all is cricket's business, not the board's. A treble seven is three
 * marks' worth of dart landing somewhere that doesn't take marks.
 */
export function marks(d: Dart): number {
  switch (d.ring) {
    case "miss":
      return 0;
    case "single":
    case "outerBull":
      return 1;
    case "double":
    case "innerBull":
      return 2;
    case "treble":
      return 3;
  }
}

/** Canonical short label: `T20`, `D16`, `5`, `25`, `BULL`, `-`. */
export function label(d: Dart): string {
  switch (d.ring) {
    case "miss":
      return "-";
    case "outerBull":
      return "25";
    case "innerBull":
      return "BULL";
    case "single":
      return String(d.wedge);
    case "double":
      return `D${d.wedge}`;
    case "treble":
      return `T${d.wedge}`;
  }
}

export function sameBed(a: Dart, b: Dart): boolean {
  if (a.ring !== b.ring) return false;
  if ("wedge" in a && "wedge" in b) return a.wedge === b.wedge;
  return true;
}

// ---------------------------------------------------------------------------
// Geometry
//
// Real dimensions of a regulation board, millimetres from the centre. These
// exist so the bot can be a physical simulation rather than a bag of tuned
// probabilities: aim at a point, scatter by a skill sigma, ask what was hit.
// Realistic misses then come for free — miss T20 sideways and you genuinely
// land in 1 or 5, because that is where they are.
// ---------------------------------------------------------------------------

export const INNER_BULL_RADIUS = 6.35;
export const OUTER_BULL_RADIUS = 15.9;
export const TREBLE_INNER_RADIUS = 99;
export const TREBLE_OUTER_RADIUS = 107;
export const DOUBLE_INNER_RADIUS = 162;
export const DOUBLE_OUTER_RADIUS = 170;

/** Wedges clockwise from the top. 20 is at 12 o'clock. */
export const WEDGES: readonly Wedge[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const WEDGE_ARC = (2 * Math.PI) / 20;

export interface Point {
  /** Millimetres right of centre. */
  readonly x: number;
  /** Millimetres above centre. */
  readonly y: number;
}

/** What a dart landing at `p` scored. */
export function bedAt(p: Point): Dart {
  const radius = Math.hypot(p.x, p.y);

  if (radius <= INNER_BULL_RADIUS) return INNER_BULL;
  if (radius <= OUTER_BULL_RADIUS) return OUTER_BULL;
  if (radius > DOUBLE_OUTER_RADIUS) return MISS;

  // Clockwise angle from straight up, so index 0 is the 20.
  const angle = Math.atan2(p.x, p.y);
  const turns = (angle + WEDGE_ARC / 2) / WEDGE_ARC;
  const index = ((Math.floor(turns) % 20) + 20) % 20;
  const wedge = WEDGES[index] as Wedge;

  if (radius >= TREBLE_INNER_RADIUS && radius <= TREBLE_OUTER_RADIUS) {
    return { ring: "treble", wedge };
  }
  if (radius >= DOUBLE_INNER_RADIUS) {
    return { ring: "double", wedge };
  }
  return { ring: "single", wedge };
}

const midRadius = (inner: number, outer: number) => (inner + outer) / 2;

/** The middle of a bed — where you'd aim for it. */
export function centreOf(b: Bed): Point {
  if (b.ring === "innerBull") return { x: 0, y: 0 };
  if (b.ring === "outerBull") {
    return { x: 0, y: midRadius(INNER_BULL_RADIUS, OUTER_BULL_RADIUS) };
  }

  const index = WEDGES.indexOf(b.wedge);
  const angle = index * WEDGE_ARC;
  const radius =
    b.ring === "treble"
      ? midRadius(TREBLE_INNER_RADIUS, TREBLE_OUTER_RADIUS)
      : b.ring === "double"
        ? midRadius(DOUBLE_INNER_RADIUS, DOUBLE_OUTER_RADIUS)
        : // The big outer single, between the treble and double rings — the fat
          // part you'd actually aim at, not the cramped inner single.
          midRadius(TREBLE_OUTER_RADIUS, DOUBLE_INNER_RADIUS);

  return { x: Math.sin(angle) * radius, y: Math.cos(angle) * radius };
}

/**
 * Below this throwing accuracy (sigma, in mm), T19 outscores T20 — because
 * missing the 20 drops you in the 1 and the 5, while missing the 19 drops you
 * in the 3 and the 7.
 *
 * This is a property of *this layout*, which is why it lives here and not with
 * the bot. We did not choose 17: it's where our own geometry puts the crossover,
 * measured by `npm run sim -- --curve`, and it lands exactly on the published
 * figure (Tibshirani, Price & Taylor, "A Statistician Plays Darts", JRSS 2011).
 */
export const SIGMA_T19_CROSSOVER = 17;

/** Every bed on the board, once each. */
export const ALL_BEDS: readonly Bed[] = [
  INNER_BULL,
  OUTER_BULL,
  ...WEDGES.flatMap((wedge): Bed[] => [
    { ring: "single", wedge },
    { ring: "double", wedge },
    { ring: "treble", wedge },
  ]),
];
