import { describe, expect, it } from "vitest";
import { bed, INNER_BULL, MISS, OUTER_BULL } from "@/core/board";

import { PALETTE } from "@/ui/theme/palette";

import { cricketScoreFeedback } from "./scoreFeedback";

describe("cricketScoreFeedback", () => {
  it("labels a miss regardless of dead state", () => {
    expect(cricketScoreFeedback(MISS, false, false)).toEqual({
      text: "MISS",
      color: PALETTE.redLight,
    });
    expect(cricketScoreFeedback(MISS, true, false)).toEqual({
      text: "MISS",
      color: PALETTE.redLight,
    });
  });

  it("labels a hit on an already-dead number as CAP", () => {
    expect(cricketScoreFeedback(bed("single", 20), true, false)).toEqual({
      text: "CAP!",
      color: PALETTE.redLight,
    });
  });

  it("labels a marks-only single as x1 in the single color", () => {
    expect(cricketScoreFeedback(bed("single", 20), false, false)).toEqual({
      text: "x1",
      color: PALETTE.single,
    });
  });

  it("labels a marks-only double as x2 in the double color", () => {
    expect(cricketScoreFeedback(bed("double", 19), false, false)).toEqual({
      text: "x2",
      color: PALETTE.double,
    });
  });

  it("labels a marks-only treble as x3 in the treble color", () => {
    expect(cricketScoreFeedback(bed("treble", 18), false, false)).toEqual({
      text: "x3",
      color: PALETTE.treble,
    });
  });

  it("treats the outer bull as a single mark and inner bull as a double", () => {
    expect(cricketScoreFeedback(OUTER_BULL, false, false)).toEqual({
      text: "x1",
      color: PALETTE.single,
    });
    expect(cricketScoreFeedback(INNER_BULL, false, false)).toEqual({
      text: "x2",
      color: PALETTE.double,
    });
  });

  it("once the thrower has already closed the number, shows the points scored instead", () => {
    expect(cricketScoreFeedback(bed("single", 20), false, true)).toEqual({
      text: "20",
      color: PALETTE.single,
    });
    expect(cricketScoreFeedback(bed("double", 19), false, true)).toEqual({
      text: "38",
      color: PALETTE.double,
    });
    expect(cricketScoreFeedback(bed("treble", 18), false, true)).toEqual({
      text: "54",
      color: PALETTE.treble,
    });
    expect(cricketScoreFeedback(INNER_BULL, false, true)).toEqual({
      text: "50",
      color: PALETTE.double,
    });
  });

  it("a dead row still shows CAP even if the thrower had already closed it", () => {
    expect(cricketScoreFeedback(bed("single", 20), true, true)).toEqual({
      text: "CAP!",
      color: PALETTE.redLight,
    });
  });
});
