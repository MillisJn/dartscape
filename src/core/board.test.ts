import { describe, expect, it } from "vitest";
import {
  ALL_BEDS,
  type Bed,
  bed,
  bedAt,
  centreOf,
  DOUBLE_OUTER_RADIUS,
  INNER_BULL,
  label,
  MISS,
  marks,
  OUTER_BULL,
  points,
  sameBed,
  WEDGES,
} from "./board";

describe("points", () => {
  it("scores each ring", () => {
    expect(points(bed("single", 20))).toBe(20);
    expect(points(bed("double", 20))).toBe(40);
    expect(points(bed("treble", 20))).toBe(60);
    expect(points(OUTER_BULL)).toBe(25);
    expect(points(INNER_BULL)).toBe(50);
    expect(points(MISS)).toBe(0);
  });

  it("tops out at 180 for three darts", () => {
    const best = Math.max(...ALL_BEDS.map(points));
    expect(best).toBe(60);
    expect(best * 3).toBe(180);
  });
});

describe("marks", () => {
  it("counts marks per ring", () => {
    expect(marks(bed("single", 19))).toBe(1);
    expect(marks(bed("double", 19))).toBe(2);
    expect(marks(bed("treble", 19))).toBe(3);
    expect(marks(OUTER_BULL)).toBe(1);
    expect(marks(INNER_BULL)).toBe(2);
    expect(marks(MISS)).toBe(0);
  });
});

describe("label", () => {
  it("reads the way players say it", () => {
    expect(label(bed("treble", 20))).toBe("T20");
    expect(label(bed("double", 16))).toBe("D16");
    expect(label(bed("single", 5))).toBe("5");
    expect(label(OUTER_BULL)).toBe("25");
    expect(label(INNER_BULL)).toBe("BULL");
    expect(label(MISS)).toBe("-");
  });
});

describe("bedAt — geometry", () => {
  it("finds the bulls at the centre", () => {
    expect(bedAt({ x: 0, y: 0 })).toEqual(INNER_BULL);
    expect(bedAt({ x: 0, y: 5 })).toEqual(INNER_BULL);
    expect(bedAt({ x: 0, y: 12 })).toEqual(OUTER_BULL);
    expect(bedAt({ x: 10, y: 0 })).toEqual(OUTER_BULL);
  });

  it("misses off the board", () => {
    expect(bedAt({ x: 0, y: 171 })).toEqual(MISS);
    expect(bedAt({ x: 500, y: 500 })).toEqual(MISS);
  });

  it("puts 20 straight up and 3 straight down", () => {
    expect(bedAt({ x: 0, y: 103 })).toEqual(bed("treble", 20));
    expect(bedAt({ x: 0, y: 166 })).toEqual(bed("double", 20));
    expect(bedAt({ x: 0, y: 140 })).toEqual(bed("single", 20));
    expect(bedAt({ x: 0, y: -166 })).toEqual(bed("double", 3));
  });

  it("puts 6 at 3 o’clock and 11 at 9 o’clock", () => {
    expect(bedAt({ x: 166, y: 0 })).toEqual(bed("double", 6));
    expect(bedAt({ x: -166, y: 0 })).toEqual(bed("double", 11));
  });

  it("lands 1 and 5 either side of 20 — the reason missing T20 hurts", () => {
    // A wedge spans 18°, so ±9° — about ±16mm out at treble radius. 12mm off
    // is still the 20; 25mm has crossed into the neighbour.
    expect(bedAt({ x: 12, y: 103 })).toEqual(bed("treble", 20));
    expect(bedAt({ x: 25, y: 103 })).toEqual(bed("treble", 1));
    expect(bedAt({ x: -25, y: 103 })).toEqual(bed("treble", 5));
  });

  it("sits the treble ring between 99 and 107mm", () => {
    expect(bedAt({ x: 0, y: 98 })).toEqual(bed("single", 20));
    expect(bedAt({ x: 0, y: 100 })).toEqual(bed("treble", 20));
    expect(bedAt({ x: 0, y: 106 })).toEqual(bed("treble", 20));
    expect(bedAt({ x: 0, y: 108 })).toEqual(bed("single", 20));
  });

  it("sits the double ring between 162 and 170mm", () => {
    expect(bedAt({ x: 0, y: 161 })).toEqual(bed("single", 20));
    expect(bedAt({ x: 0, y: 163 })).toEqual(bed("double", 20));
    expect(bedAt({ x: 0, y: DOUBLE_OUTER_RADIUS })).toEqual(bed("double", 20));
  });
});

describe("centreOf", () => {
  it("round-trips every bed through the geometry", () => {
    for (const b of ALL_BEDS) {
      expect(bedAt(centreOf(b)), `${label(b)} did not round-trip`).toEqual(b);
    }
  });

  it("aims the inner bull dead centre", () => {
    expect(centreOf(INNER_BULL)).toEqual({ x: 0, y: 0 });
  });
});

describe("sameBed", () => {
  it("compares beds structurally", () => {
    expect(sameBed(bed("treble", 20), bed("treble", 20))).toBe(true);
    expect(sameBed(bed("treble", 20), bed("single", 20))).toBe(false);
    expect(sameBed(bed("treble", 20), bed("treble", 19))).toBe(false);
    expect(sameBed(INNER_BULL, INNER_BULL)).toBe(true);
    expect(sameBed(INNER_BULL, OUTER_BULL)).toBe(false);
    expect(sameBed(MISS, MISS)).toBe(true);
  });
});

describe("the board itself", () => {
  it("has 20 unique wedges", () => {
    expect(WEDGES).toHaveLength(20);
    expect(new Set(WEDGES).size).toBe(20);
  });

  it("has 62 beds — 20 wedges x 3 rings, plus two bulls", () => {
    expect(ALL_BEDS).toHaveLength(62);
  });

  it("cannot represent a treble bull", () => {
    // Not an assertion so much as a note: the line below does not compile,
    // which is the entire point of modelling beds as a union.
    // @ts-expect-error — 'treble' requires a wedge; the bull has none.
    const impossible: Bed = { ring: "treble" };
    expect(impossible).toBeDefined();
  });
});
