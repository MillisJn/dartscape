import { describe, expect, it } from "vitest";
import { type Bed, INNER_BULL, label, points } from "../board";
import { bestCheckout, maxCheckout, minFinish, satisfies } from "./checkout";

const route = (score: number, rule: Parameters<typeof bestCheckout>[1] = "double") =>
  bestCheckout(score, rule)?.map(label).join(" ") ?? null;

describe("satisfies", () => {
  it("accepts anything on straight", () => {
    expect(satisfies("straight", { ring: "single", wedge: 7 })).toBe(true);
  });

  it("counts the inner bull as a double, but not the outer", () => {
    expect(satisfies("double", INNER_BULL)).toBe(true);
    expect(satisfies("double", { ring: "outerBull" })).toBe(false);
  });

  it("takes doubles or trebles on master", () => {
    expect(satisfies("master", { ring: "double", wedge: 10 })).toBe(true);
    expect(satisfies("master", { ring: "treble", wedge: 10 })).toBe(true);
    expect(satisfies("master", { ring: "single", wedge: 10 })).toBe(false);
  });
});

describe("minFinish", () => {
  it("knows you cannot finish 1 on a double", () => {
    expect(minFinish("double")).toBe(2);
    expect(minFinish("straight")).toBe(1);
    expect(minFinish("treble")).toBe(3);
    expect(minFinish("master")).toBe(2);
  });
});

describe("maxCheckout", () => {
  it("is 170 on double-out — the big fish", () => {
    expect(maxCheckout("double")).toBe(170);
  });

  it("is 180 on straight-out", () => {
    expect(maxCheckout("straight")).toBe(180);
  });
});

describe("bestCheckout — the ones every player knows", () => {
  it("finishes 170 with the big fish", () => {
    expect(route(170)).toBe("T20 T20 BULL");
  });

  it("finishes 40 on D20", () => {
    expect(route(40)).toBe("D20");
  });

  it("finishes 32 on D16", () => {
    expect(route(32)).toBe("D16");
  });

  it("finishes 100 as T20 D20", () => {
    expect(route(100)).toBe("T20 D20");
  });

  it("finishes 167 as T20 T19 BULL", () => {
    expect(route(167)).toBe("T20 T19 BULL");
  });

  it("finishes 50 on the bull", () => {
    expect(route(50)).toBe("BULL");
  });
});

describe("bestCheckout — limits", () => {
  it("refuses 171 on double-out: not gettable in three", () => {
    expect(route(171)).toBeNull();
  });

  it("refuses 169, 168, 166, 165, 163, 162, 159 — the classic bogey numbers", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
      expect(route(bogey), `${bogey} should be unfinishable`).toBeNull();
    }
  });

  it("refuses 1 on double-out", () => {
    expect(route(1)).toBeNull();
  });

  it("refuses zero and negatives", () => {
    expect(route(0)).toBeNull();
    expect(route(-5)).toBeNull();
  });
});

describe("bestCheckout — every route is arithmetically sound", () => {
  const rules = ["straight", "double", "treble", "master"] as const;

  for (const rule of rules) {
    it(`sums to the score and finishes legally on ${rule}-out`, () => {
      let found = 0;
      for (let score = 1; score <= 180; score++) {
        const r = bestCheckout(score, rule);
        if (!r) continue;
        found++;

        const total = r.reduce((sum, b) => sum + points(b), 0);
        expect(total, `${rule} ${score}: ${r.map(label).join(" ")}`).toBe(score);
        expect(r.length).toBeLessThanOrEqual(3);

        const last = r[r.length - 1] as Bed;
        expect(satisfies(rule, last), `${rule} ${score} ended on ${label(last)}`).toBe(true);
      }
      expect(found).toBeGreaterThan(0);
    });
  }

  it("never leaves an unfinishable remainder mid-route on double-out", () => {
    for (let score = 2; score <= 170; score++) {
      const r = bestCheckout(score, "double");
      if (!r) continue;
      let left = score;
      for (const b of r.slice(0, -1)) {
        left -= points(b);
        expect(left, `${score} left ${left} mid-route`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("bestCheckout — prefers a friendly double", () => {
  it("takes 80 as T20 D10 rather than something awkward", () => {
    const r = bestCheckout(80, "double");
    expect(r?.length).toBe(2);
    expect(label(r?.[1] as Bed)).toMatch(/^D/);
  });

  it("leaves a double, not the bull, when both work", () => {
    // 60 = T20 (single dart, not a legal double finish) or 20 + D20.
    expect(route(60)).toBe("20 D20");
  });
});
