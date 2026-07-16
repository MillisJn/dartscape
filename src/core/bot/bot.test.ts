import { describe, expect, it } from "vitest";
import { type Bed, bed, INNER_BULL, points, SIGMA_T19_CROSSOVER } from "../board";
import {
  gaussian,
  measurePpd,
  SKILL,
  SKILL_NAMES,
  scatter,
  seeded,
  skillName,
  throwAt,
} from "./bot";

const T20: Bed = bed("treble", 20);
const DARTS = 20_000;

/** PPD aiming at T20 for a given sigma. */
const ppdAtT20 = (sigma: number, seed = 1) => measurePpd(T20, sigma, seeded(seed), DARTS, points);

describe("seeded rng", () => {
  it("repeats exactly", () => {
    const a = seeded(42);
    const b = seeded(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs across seeds", () => {
    expect(seeded(1)()).not.toBe(seeded(2)());
  });

  it("stays in [0, 1)", () => {
    const rng = seeded(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("gaussian", () => {
  it("has mean about 0 and sd about 1", () => {
    const rng = seeded(3);
    const xs = Array.from({ length: 50_000 }, () => gaussian(rng));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(mean).toBeCloseTo(0, 1);
    expect(sd).toBeCloseTo(1, 1);
  });
});

describe("scatter", () => {
  it("lands on the aim point with no error", () => {
    expect(scatter({ x: 10, y: 20 }, 0, seeded(1))).toEqual({ x: 10, y: 20 });
  });

  it("spreads around the aim point", () => {
    const rng = seeded(5);
    const pts = Array.from({ length: 20_000 }, () => scatter({ x: 0, y: 100 }, 20, rng));
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    expect(mx).toBeCloseTo(0, 0);
    expect(my).toBeCloseTo(100, 0);
  });
});

describe("throwAt", () => {
  it("hits what it aims at when it cannot miss", () => {
    expect(throwAt(T20, 0, seeded(1))).toEqual(T20);
    expect(throwAt(INNER_BULL, 0, seeded(1))).toEqual(INNER_BULL);
  });

  it("is deterministic for a seed", () => {
    expect(throwAt(T20, 30, seeded(9))).toEqual(throwAt(T20, 30, seeded(9)));
  });

  it("lands somewhere real", () => {
    const rng = seeded(11);
    for (let i = 0; i < 500; i++) {
      const d = throwAt(T20, 40, rng);
      expect(points(d)).toBeGreaterThanOrEqual(0);
      expect(points(d)).toBeLessThanOrEqual(60);
    }
  });
});

describe("the skill curve", () => {
  it("names every tier by sigma", () => {
    expect(skillName(SKILL.PERFECT)).toBe("PERFECT");
    expect(skillName(SKILL.MASTER)).toBe("MASTER");
    expect(skillName(SKILL.BEGINNER)).toBe("BEGINNER");
    expect(skillName(100)).toBe("BEGINNER");
  });

  it("runs from worst to best", () => {
    const sigmas = SKILL_NAMES.map((n) => SKILL[n]);
    const sorted = [...sigmas].sort((a, b) => b - a);
    expect(sigmas).toEqual(sorted);
  });

  it("gets monotonically better as sigma falls", () => {
    const ppds = SKILL_NAMES.map((n) => ppdAtT20(SKILL[n]));
    for (let i = 1; i < ppds.length; i++) {
      expect(ppds[i], `${SKILL_NAMES[i]} should beat ${SKILL_NAMES[i - 1]}`).toBeGreaterThan(
        ppds[i - 1] as number,
      );
    }
  });

  it("puts PERFECT within touching distance of a maximum", () => {
    // 60 a dart is 180 a visit. Nine-darter territory.
    expect(ppdAtT20(SKILL.PERFECT) * 3).toBeGreaterThan(170);
  });

  it("puts MASTER at a professional average", () => {
    // Pros average 90-100+ over a leg.
    const avg = ppdAtT20(SKILL.MASTER) * 3;
    expect(avg).toBeGreaterThan(90);
    expect(avg).toBeLessThan(115);
  });

  it("puts HARD at a solid league average", () => {
    const avg = ppdAtT20(SKILL.HARD) * 3;
    expect(avg).toBeGreaterThan(50);
    expect(avg).toBeLessThan(70);
  });

  it("puts BEGINNER somewhere humbling", () => {
    const avg = ppdAtT20(SKILL.BEGINNER) * 3;
    expect(avg).toBeGreaterThan(20);
    expect(avg).toBeLessThan(40);
  });
});

describe("realistic misses come from the geometry, not from a table", () => {
  it("sprays a weak thrower into 20s neighbours, 1 and 5", () => {
    const rng = seeded(13);
    const hits = new Map<number, number>();
    for (let i = 0; i < 5000; i++) {
      const d = throwAt(T20, 45, rng);
      if ("wedge" in d) hits.set(d.wedge, (hits.get(d.wedge) ?? 0) + 1);
    }
    // 1 and 5 sit either side of the 20, so they should be the top misses.
    const misses = [...hits.entries()].filter(([w]) => w !== 20).sort((a, b) => b[1] - a[1]);
    const worst = misses.slice(0, 2).map(([w]) => w);
    expect(worst.sort()).toEqual([1, 5]);
  });

  it("barely misses at all when the thrower is good", () => {
    const rng = seeded(17);
    let onTwenty = 0;
    for (let i = 0; i < 2000; i++) {
      const d = throwAt(T20, SKILL.MASTER, rng);
      if ("wedge" in d && d.wedge === 20) onTwenty++;
    }
    expect(onTwenty / 2000).toBeGreaterThan(0.6);
  });
});

describe("T19 vs T20 — the reason a weak bot should not chase the 20", () => {
  const T19: Bed = bed("treble", 19);
  const ppdAtT19 = (sigma: number) => measurePpd(T19, sigma, seeded(1), DARTS, points);

  it("makes T20 the right target for a good thrower", () => {
    expect(ppdAtT20(10)).toBeGreaterThan(ppdAtT19(10));
  });

  it("makes T19 the right target for a weak one", () => {
    expect(ppdAtT19(45)).toBeGreaterThan(ppdAtT20(45));
  });

  it("crosses over where SIGMA_T19_CROSSOVER says it does", () => {
    // Nothing in the code puts the crossover here — it falls out of the board's
    // real geometry, and it lands on the published figure of ~17mm. If this
    // fails, the geometry has drifted.
    const below = SIGMA_T19_CROSSOVER - 4;
    const above = SIGMA_T19_CROSSOVER + 4;
    expect(ppdAtT20(below)).toBeGreaterThan(ppdAtT19(below));
    expect(ppdAtT19(above)).toBeGreaterThan(ppdAtT20(above));
  });
});
