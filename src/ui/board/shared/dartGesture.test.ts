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
  it("lands a single instantly on press", () => {
    const result = reduceGesture(IDLE_GESTURE, { kind: "down", cell: 20, t: 0 });
    expect(result.emit).toEqual({ kind: "land", cell: 20 });
    expect(result.state).toEqual({ phase: "pending", cell: 20, downAt: 0, isDown: true });
  });

  it("a tap (up before the window closes, nothing else) resolves to single — no further emit", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
    ]);
    // The single already landed on press; releasing early just keeps the window open.
    expect(emits[1]).toBeUndefined();
    expect(state).toEqual({ phase: "pending", cell: 20, downAt: 0, isDown: false });

    // If the window then elapses with nothing else happening, it settles as a plain single.
    const settled = reduceGesture(state, { kind: "holdElapsed", cell: 20, t: 250 });
    expect(settled.emit).toBeUndefined();
    expect(settled.state).toEqual({ phase: "idle" });
  });

  it("a second tap within the window upgrades to double, replacing the single", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      { kind: "down", cell: 20, t: 180 },
    ]);
    expect(emits[0]).toEqual({ kind: "land", cell: 20 });
    expect(emits[2]).toEqual({ kind: "upgrade", cell: 20, multiplier: "double" });
    expect(state).toEqual({ phase: "idle" });
  });

  it("holding past HOLD_MS upgrades to treble", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "holdElapsed", cell: 20, t: 300 },
    ]);
    expect(emits[1]).toEqual({ kind: "upgrade", cell: 20, multiplier: "treble" });
    expect(state).toEqual({ phase: "idle" });
  });

  it("a press on a different cell commits the first as a single and starts fresh", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "down", cell: 5, t: 100 },
    ]);
    expect(emits[0]).toEqual({ kind: "land", cell: 20 });
    // Nothing further to emit for cell 20 — it already landed as a single.
    expect(emits[1]).toEqual({ kind: "land", cell: 5 });
    expect(state).toEqual({ phase: "pending", cell: 5, downAt: 100, isDown: true });
  });

  it("a re-tap after the window has already elapsed starts a fresh single, not a double", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      { kind: "down", cell: 20, t: HOLD_MS + 10 },
    ]);
    expect(emits[2]).toEqual({ kind: "land", cell: 20 });
    expect(state).toEqual({
      phase: "pending",
      cell: 20,
      downAt: HOLD_MS + 10,
      isDown: true,
    });
  });

  it("a stray up with nothing pending is a no-op", () => {
    const result = reduceGesture(IDLE_GESTURE, { kind: "up", cell: 20, t: 0 });
    expect(result.emit).toBeUndefined();
    expect(result.state).toEqual(IDLE_GESTURE);
  });

  it("a stray holdElapsed for a cell that already resolved is a no-op", () => {
    const { state: afterUpgrade } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: 40 },
      { kind: "down", cell: 20, t: 100 }, // double-tap: upgrades to double, back to idle
    ]);
    expect(afterUpgrade).toEqual({ phase: "idle" });
    const stray = reduceGesture(afterUpgrade, { kind: "holdElapsed", cell: 20, t: 250 });
    expect(stray.emit).toBeUndefined();
    expect(stray.state).toEqual({ phase: "idle" });
  });

  it("release itself resolves to treble if it happens to land past HOLD_MS (timer-jitter safety net)", () => {
    const { state, emits } = apply(IDLE_GESTURE, [
      { kind: "down", cell: 20, t: 0 },
      { kind: "up", cell: 20, t: HOLD_MS },
    ]);
    expect(emits[1]).toEqual({ kind: "upgrade", cell: 20, multiplier: "treble" });
    expect(state).toEqual({ phase: "idle" });
  });
});
