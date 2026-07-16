import { describe, expect, it } from "vitest";
import { type GestureState, HOLD_MS, IDLE_GESTURE, reduceGesture } from "./dartGesture";

function apply(state: GestureState, touches: Parameters<typeof reduceGesture>[1][]) {
  let current = state;
  const emits: ReturnType<typeof reduceGesture>["emit"][] = [];
  for (const touch of touches) {
    const result = reduceGesture(current, touch);
    current = result.state;
    emits.push(result.emit);
  }
  return { state: current, emits };
}

describe("dartGesture", () => {
  it("a press alone emits nothing — a gesture never resolves until it's disambiguated", () => {
    const result = reduceGesture(IDLE_GESTURE, { kind: "down", cell: 20, t: 0 });
    expect(result.emit).toBeUndefined();
    expect(result.state).toEqual({ phase: "pending", cell: 20, isDown: true, since: 0 });
  });

  it("a tap (up before the window closes, nothing else) resolves to single once the window elapses", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
    ]);
    // Released within the window: still waiting to see whether a second tap follows.
    expect(emits[1]).toBeUndefined();
    expect(state).toEqual({ phase: "pending", cell: 20, isDown: false, since: 40 });

    // The caller's timer fires HOLD_MS after the release (not the original press) — nothing
    // else arrived, so it settles as a plain single. This is the ONLY emit for this gesture.
    const settled = reduceGesture(state, { kind: "holdElapsed", cell: 20, t: 40 + HOLD_MS });
    expect(settled.emit).toEqual({ kind: "resolve", cell: 20, multiplier: "single" });
    expect(settled.state).toEqual({ phase: "idle" });
  });

  it("a second tap within the window resolves straight to double — no single ever fires", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      { kind: "down", cell: 20, t: 180 },
    ]);
    expect(emits[0]).toBeUndefined();
    expect(emits[1]).toBeUndefined();
    expect(emits[2]).toEqual({ kind: "resolve", cell: 20, multiplier: "double" });
    expect(state).toEqual({ phase: "idle" });
  });

  it("holding past HOLD_MS resolves to treble", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "holdElapsed", cell: 20, t: HOLD_MS },
    ]);
    expect(emits[0]).toBeUndefined();
    expect(emits[1]).toEqual({ kind: "resolve", cell: 20, multiplier: "treble" });
    expect(state).toEqual({ phase: "idle" });
  });

  it("a press on a different cell abandons an unresolved (still-down) first press", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "down", cell: 5, t: 100 },
    ]);
    // Cell 20 never released — nothing to score for it, unlike a real single-finger touch
    // sequence (which can't produce this), but a safe fallback all the same.
    expect(emits[0]).toBeUndefined();
    expect(emits[1]).toBeUndefined();
    expect(state).toEqual({ phase: "pending", cell: 5, isDown: true, since: 100 });
  });

  it("a press on a different cell settles an already-released first press as a single", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      { kind: "down", cell: 5, t: 100 },
    ]);
    expect(emits[1]).toBeUndefined();
    expect(emits[2]).toEqual({ kind: "resolve", cell: 20, multiplier: "single" });
    expect(state).toEqual({ phase: "pending", cell: 5, isDown: true, since: 100 });
  });

  it("a re-tap after the window has already elapsed starts a fresh press, not a double", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      // The caller's timer fires first in real operation, settling the first tap as a single.
      { kind: "holdElapsed", cell: 20, t: 40 + HOLD_MS },
      { kind: "down", cell: 20, t: 40 + HOLD_MS + 10 },
    ]);
    expect(emits[2]).toEqual({ kind: "resolve", cell: 20, multiplier: "single" });
    expect(emits[3]).toBeUndefined();
    expect(state).toEqual({
      phase: "pending",
      cell: 20,
      isDown: true,
      since: 40 + HOLD_MS + 10,
    });
  });

  it("a stray up with nothing pending is a no-op", () => {
    const result = reduceGesture(IDLE_GESTURE, { kind: "up", cell: 20, t: 0 });
    expect(result.emit).toBeUndefined();
    expect(result.state).toEqual(IDLE_GESTURE);
  });

  it("a stray holdElapsed for a cell that already resolved is a no-op", () => {
    const { state: afterDouble } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      { kind: "down", cell: 20, t: 100 }, // double-tap: resolves immediately, back to idle
    ]);
    expect(afterDouble).toEqual({ phase: "idle" });
    const stray = reduceGesture(afterDouble, { kind: "holdElapsed", cell: 20, t: 250 });
    expect(stray.emit).toBeUndefined();
    expect(stray.state).toEqual({ phase: "idle" });
  });

  it("release itself resolves to treble if it happens to land past HOLD_MS (timer-jitter safety net)", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: HOLD_MS },
    ]);
    expect(emits[1]).toEqual({ kind: "resolve", cell: 20, multiplier: "treble" });
    expect(state).toEqual({ phase: "idle" });
  });
});
