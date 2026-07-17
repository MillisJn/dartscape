import { describe, expect, it } from "vitest";
import { bed, INNER_BULL, MISS, OUTER_BULL } from "@/core/board";
import type { GameEvent, Target } from "@/core/game/events";

import { PALETTE } from "@/ui/theme/palette";

import { cricketFeedbackFromEvents } from "./scoreFeedback";

const marked = (seat: number, target: Target, m: number): GameEvent => ({
  type: "marked",
  seat,
  target,
  marks: m,
});

describe("cricketFeedbackFromEvents", () => {
  it("labels a miss and reads the seat from the dartMissed event", () => {
    const events: GameEvent[] = [{ type: "dartMissed", seat: 2, dart: MISS }];
    expect(cricketFeedbackFromEvents(MISS, events)).toEqual({
      text: "MISS",
      color: PALETTE.redLight,
      seat: 2,
    });
  });

  it("labels a marks-only single as x1 in the single color", () => {
    const events: GameEvent[] = [marked(0, 20, 1)];
    expect(cricketFeedbackFromEvents(bed("single", 20), events)).toEqual({
      text: "x1",
      color: PALETTE.single,
      seat: 0,
    });
  });

  it("labels a marks-only double as x2 and treble as x3", () => {
    expect(cricketFeedbackFromEvents(bed("double", 19), [marked(1, 19, 2)])).toEqual({
      text: "x2",
      color: PALETTE.double,
      seat: 1,
    });
    expect(cricketFeedbackFromEvents(bed("treble", 18), [marked(1, 18, 3)])).toEqual({
      text: "x3",
      color: PALETTE.treble,
      seat: 1,
    });
  });

  it("shows the points scored when the dart produced a dartScored event", () => {
    const events: GameEvent[] = [
      marked(0, 20, 0),
      { type: "dartScored", seat: 0, dart: bed("double", 20), points: 40 },
    ];
    expect(cricketFeedbackFromEvents(bed("double", 20), events)).toEqual({
      text: "40",
      color: PALETTE.double,
      seat: 0,
    });
  });

  it("labels a hit on a dead number (0 new marks, nothing scored) as CAP", () => {
    const events: GameEvent[] = [marked(3, 20, 0)];
    expect(cricketFeedbackFromEvents(bed("single", 20), events)).toEqual({
      text: "CAP!",
      color: PALETTE.redLight,
      seat: 3,
    });
  });

  it("treats the outer bull as one mark and the inner bull as two", () => {
    expect(cricketFeedbackFromEvents(OUTER_BULL, [marked(0, "bull", 1)])).toEqual({
      text: "x1",
      color: PALETTE.single,
      seat: 0,
    });
    expect(cricketFeedbackFromEvents(INNER_BULL, [marked(0, "bull", 2)])).toEqual({
      text: "x2",
      color: PALETTE.double,
      seat: 0,
    });
  });

  it("treats an off-sheet bed (dartMissed event) as a MISS even though the dart isn't MISS", () => {
    const events: GameEvent[] = [{ type: "dartMissed", seat: 1, dart: bed("single", 3) }];
    expect(cricketFeedbackFromEvents(bed("single", 3), events)).toEqual({
      text: "MISS",
      color: PALETTE.redLight,
      seat: 1,
    });
  });

  it("returns a null seat when no event carries one", () => {
    expect(cricketFeedbackFromEvents(bed("single", 20), []).seat).toBeNull();
  });
});
