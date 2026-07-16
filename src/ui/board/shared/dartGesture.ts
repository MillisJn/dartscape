/**
 * The input model — PURE. No React, no timers, no Skia. Board.tsx §"What it does NOT mean":
 * because we can't feel the gesture on a device, it has to be a pure function we can prove with
 * synthetic timings instead.
 *
 * The gesture, from Dartscape 1 (ScoreButton.java's mScoreTouchListener): tap = SINGLE,
 * double-tap = DOUBLE, hold = TREBLE. That original waited to disambiguate before firing anything
 * — a plain tap sat behind a HOLD_MS wait for a possible second tap — and this port keeps that:
 * every gesture resolves to exactly one dart, once, whichever way it lands. (An earlier version of
 * this file tried landing a single instantly and "upgrading" it on a later tap/hold, so the caller
 * could pop-and-replace the log entry — but that means every listener downstream (log, animations,
 * sounds) fires twice for one throw: once for the single that was about to be overwritten, once for
 * the real result. Visibly, that reads as two flashes/sounds for one dart. Resolving once, like the
 * original, avoids the whole class of bug at the source.)
 *
 * This module knows nothing about darts, boards, or wedges — it escalates an abstract numbered
 * `cell` through single -> double -> treble. The caller (useDartGesture + a board's hit-test) maps
 * `cell` to a real Bed/Dart. That's what makes it reusable across every panel's escalating targets,
 * not just X01's grid.
 */

/** Both windows this state machine waits on: how long a hold takes to become a treble, and how
 * long after a release a second tap still counts as a double. One constant, like the original. */
export const HOLD_MS = 250;

export type Multiplier = "single" | "double" | "treble";

export type GestureTouch =
  | { readonly kind: "down"; readonly cell: number; readonly t: number }
  | { readonly kind: "up"; readonly cell: number; readonly t: number }
  /**
   * Fired by the caller's timer HOLD_MS after entering a pending sub-state (a fresh down, or a
   * release), if that sub-state is still unresolved. The timer only reports elapsed time; this
   * function is what decides what it means — a treble if still held, a single if not.
   */
  | { readonly kind: "holdElapsed"; readonly cell: number; readonly t: number };

export type GestureState =
  | { readonly phase: "idle" }
  | {
      readonly phase: "pending";
      readonly cell: number;
      readonly isDown: boolean;
      /** When this sub-phase began: the down time while isDown, the release time once
       * released — the clock HOLD_MS counts from, whichever window currently applies. */
      readonly since: number;
    };

export const IDLE_GESTURE: GestureState = { phase: "idle" };

/** The one dart this gesture ever resolves to — the caller looks up its cell's target and
 * builds the Dart for `multiplier`. Fires exactly once per gesture. */
export type GestureEmit = {
  readonly kind: "resolve";
  readonly cell: number;
  readonly multiplier: Multiplier;
};

export interface GestureResult {
  readonly state: GestureState;
  readonly emit?: GestureEmit;
}

function pendingDown(cell: number, t: number): GestureState {
  return { phase: "pending", cell, isDown: true, since: t };
}

function resolve(cell: number, multiplier: Multiplier): GestureResult {
  return { state: { phase: "idle" }, emit: { kind: "resolve", cell, multiplier } };
}

export function reduceGesture(state: GestureState, touch: GestureTouch): GestureResult {
  switch (touch.kind) {
    case "down": {
      if (state.phase === "pending" && state.cell !== touch.cell) {
        // Moving to a different cell settles whatever was pending on the old one: if it had
        // already been released once, it looked like a single and settles as one now; if it
        // was still held with nothing resolved yet, there's nothing to score for it.
        const next = { state: pendingDown(touch.cell, touch.t) };
        if (state.isDown) return next;
        return { ...next, emit: { kind: "resolve", cell: state.cell, multiplier: "single" } };
      }

      if (state.phase === "pending" && state.cell === touch.cell && !state.isDown) {
        // A second tap on the SAME cell, released once already: within the window it's a
        // double; otherwise the window had already elapsed (it should have auto-resolved to
        // single already) and this is really a fresh press.
        if (touch.t - state.since < HOLD_MS) return resolve(touch.cell, "double");
        return { state: pendingDown(touch.cell, touch.t) };
      }

      // Fresh press on an idle board (or a stray repeated "down" on an already-down cell).
      return { state: pendingDown(touch.cell, touch.t) };
    }

    case "up": {
      if (state.phase !== "pending" || state.cell !== touch.cell || !state.isDown) {
        return { state }; // stray release — nothing pending for this cell
      }
      if (touch.t - state.since >= HOLD_MS) {
        // Held past the threshold and only now released: still a treble — a safety net
        // against timer jitter, not the primary path (the caller's timer normally fires
        // holdElapsed at the threshold before this can happen).
        return resolve(touch.cell, "treble");
      }
      // Released within the window: wait to see whether a second tap follows.
      return { state: { phase: "pending", cell: touch.cell, isDown: false, since: touch.t } };
    }

    case "holdElapsed": {
      if (state.phase !== "pending" || state.cell !== touch.cell) {
        return { state }; // already resolved — a different cell took over, or it resolved
      }
      // Still held past the threshold: a treble. Already released with nothing else arriving
      // by now: it settles as a plain single.
      return resolve(touch.cell, state.isDown ? "treble" : "single");
    }
  }
}
