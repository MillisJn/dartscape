import { describe, expect, it } from "vitest";
import { bed, INNER_BULL, MISS, OUTER_BULL } from "@/core/board";

import { PALETTE } from "@/ui/theme/palette";

import { cricketScoreFeedback } from "./scoreFeedback";

describe("cricketScoreFeedback", () => {
  it("labels a miss regardless of dead state", () => {
    expect(cricketScoreFeedback(MISS, false)).toEqual({ text: "MISS", color: PALETTE.redLight });
    expect(cricketScoreFeedback(MISS, true)).toEqual({ text: "MISS", color: PALETTE.redLight });
  });

  it("labels a hit on an already-dead number as CAP", () => {
    expect(cricketScoreFeedback(bed("single", 20), true)).toEqual({
      text: "CAP!",
      color: PALETTE.redLight,
    });
  });

  it("labels a single with the single color", () => {
    expect(cricketScoreFeedback(bed("single", 20), false)).toEqual({
      text: "x1",
      color: PALETTE.single,
    });
  });

  it("labels a double with the double color", () => {
    expect(cricketScoreFeedback(bed("double", 19), false)).toEqual({
      text: "x2",
      color: PALETTE.double,
    });
  });

  it("labels a treble with the treble color", () => {
    expect(cricketScoreFeedback(bed("treble", 18), false)).toEqual({
      text: "x3",
      color: PALETTE.treble,
    });
  });

  it("treats the outer bull as a single mark and inner bull as a double", () => {
    expect(cricketScoreFeedback(OUTER_BULL, false)).toEqual({ text: "x1", color: PALETTE.single });
    expect(cricketScoreFeedback(INNER_BULL, false)).toEqual({ text: "x2", color: PALETTE.double });
  });
});
