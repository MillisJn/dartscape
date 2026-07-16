import { getAppFeedbackState } from "@spatch-kit/ui/overlays/system/appFeedbackController";
import { beforeEach, describe, expect, it } from "vitest";
import type { GameEvent, GameEventType } from "@/core/game/events";
import { type SoundName, setSoundPlayer } from "./sound";
import { applyGameEvent } from "./useGameEvents";

/** One example of every event type — proves applyGameEvent's switch is exhaustive (assertNever
 * would fail to compile if a case were missing) and that each one runs without throwing. */
const EXAMPLES: readonly GameEvent[] = [
  { type: "dartScored", seat: 0, dart: { ring: "single", wedge: 20 }, points: 20 },
  { type: "dartMissed", seat: 0, dart: { ring: "miss" } },
  { type: "visitEnded", seat: 0, next: 1 },
  { type: "roundEnded", round: 1 },
  { type: "won", seat: 0 },
  { type: "bust", seat: 0, restoredTo: 40 },
  { type: "notOpenedYet", seat: 0, dart: { ring: "single", wedge: 5 } },
  { type: "opened", seat: 0 },
  { type: "checkout", seat: 0, points: 40, darts: 1 },
  { type: "marked", seat: 0, target: 20, marks: 3 },
  { type: "targetClosed", seat: 0, target: 20 },
  { type: "targetDead", target: 20 },
  { type: "shanghai", seat: 0, target: 7 },
  { type: "baseHit", seat: 0, bases: 1, runs: 0 },
  { type: "homeRun", seat: 0, runs: 1 },
  { type: "grandSlam", seat: 0 },
  { type: "out", seat: 0, outs: 1 },
  { type: "inningEnded", inning: 1 },
  { type: "numberClaimed", seat: 0, target: 20 },
  { type: "becameKiller", seat: 0 },
  { type: "lostKillerStatus", seat: 0 },
  { type: "lifeLost", seat: 0, by: 1, livesLeft: 2 },
  { type: "eliminated", seat: 0 },
];

describe("applyGameEvent", () => {
  it("covers every GameEventType exactly once (this test's own completeness check)", () => {
    const allTypes: readonly GameEventType[] = [
      "dartScored",
      "dartMissed",
      "visitEnded",
      "roundEnded",
      "won",
      "bust",
      "notOpenedYet",
      "opened",
      "checkout",
      "marked",
      "targetClosed",
      "targetDead",
      "shanghai",
      "baseHit",
      "homeRun",
      "grandSlam",
      "out",
      "inningEnded",
      "numberClaimed",
      "becameKiller",
      "lostKillerStatus",
      "lifeLost",
      "eliminated",
    ];
    expect(EXAMPLES.map((e) => e.type).sort()).toEqual([...allTypes].sort());
  });

  it("runs every event type without throwing", () => {
    for (const event of EXAMPLES) {
      expect(() => applyGameEvent(event)).not.toThrow();
    }
  });

  describe("sound", () => {
    let played: SoundName[] = [];
    beforeEach(() => {
      played = [];
      setSoundPlayer((sound) => played.push(sound));
    });

    it("plays a sound for a scored dart", () => {
      applyGameEvent({
        type: "dartScored",
        seat: 0,
        dart: { ring: "single", wedge: 20 },
        points: 20,
      });
      expect(played).toEqual(["dartScored"]);
    });

    it("plays a sound for a bust", () => {
      applyGameEvent({ type: "bust", seat: 0, restoredTo: 40 });
      expect(played).toEqual(["bust"]);
    });
  });

  describe("toast", () => {
    it("shows BUST! on a bust", () => {
      applyGameEvent({ type: "bust", seat: 0, restoredTo: 40 });
      expect(getAppFeedbackState().toast?.message).toBe("BUST!");
    });

    it("shows CHECKOUT! on a checkout", () => {
      applyGameEvent({ type: "checkout", seat: 0, points: 40, darts: 1 });
      expect(getAppFeedbackState().toast?.message).toBe("CHECKOUT!");
    });
  });
});
