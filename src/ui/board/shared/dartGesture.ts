/**
 * The input model — PURE. No React, no timers, no Skia. Board.tsx §"What it does NOT mean":
 * because we can't feel the gesture on a device, it has to be a pure function we can prove with
 * synthetic timings instead.
 *
 * The gesture, from Dartscape 1 (ScoreButton.java's mScoreTouchListener): tap = SINGLE,
 * double-tap = DOUBLE, hold = TREBLE. The old app waited HOLD_MS before landing anything, so even
 * a plain single — the most common throw — sat behind a quarter-second delay. The fix: land the
 * single instantly on press, and if a second tap or a hold arrives, pop it and push the upgrade.
 * The log is the truth; undo is log.slice(0, -1), so "pop and push" is just two log ops upstream.
 *
 * This module knows nothing about darts, boards, or wedges — it escalates an abstract numbered
 * `cell` through single -> double -> treble. The caller (useDartGesture + a board's hit-test) maps
 * `cell` to a real Bed/Dart. That's what makes it reusable across every panel's escalating targets,
 * not just X01's grid.
 */

export const HOLD_MS = 250;

export type Multiplier = "single" | "double" | "treble";

export type GestureTouch =
  | { readonly kind: "down"; readonly cell: number; readonly t: number }
  | { readonly kind: "up"; readonly cell: number; readonly t: number }
  /**
   * Fired by the caller's timer HOLD_MS after a "down", if that same press is still down and
   * unresolved. The timer only reports elapsed time; this function is what decides what it means.
   */
  | { readonly kind: "holdElapsed"; readonly cell: number; readonly t: number };

export type GestureState =
  | { readonly phase: "idle" }
  | {
      readonly phase: "pending";
      readonly cell: number;
      readonly downAt: number;
      readonly isDown: boolean;
    };

export const IDLE_GESTURE: GestureState = { phase: "idle" };

export type GestureEmit =
  /** The instant single that lands the moment a cell is first pressed. */
  | { readonly kind: "land"; readonly cell: number }
  /** Pop the previous dart on this cell, push the new multiplier — the upgrade. */
  | { readonly kind: "upgrade"; readonly cell: number; readonly multiplier: "double" | "treble" };

export interface GestureResult {
  readonly state: GestureState;
  readonly emit?: GestureEmit;
}

function startPending(cell: number, t: number): GestureResult {
  return {
    state: { phase: "pending", cell, downAt: t, isDown: true },
    emit: { kind: "land", cell },
  };
}

export function reduceGesture(state: GestureState, touch: GestureTouch): GestureResult {
  switch (touch.kind) {
    case "down": {
      if (state.phase === "pending" && state.cell !== touch.cell) {
        // A different cell commits the first instantly — it already landed as a single, so there
        // is nothing further to emit for it — and starts its own pending window.
        return startPending(touch.cell, touch.t);
      }

      if (state.phase === "pending" && state.cell === touch.cell && !state.isDown) {
        // A second tap on the SAME cell, released once already: upgrade to double if it's within
        // the window; otherwise the window had already elapsed (it should have auto-resolved to
        // single already) and this is really a fresh press.
        if (touch.t - state.downAt < HOLD_MS) {
          return {
            state: { phase: "idle" },
            emit: { kind: "upgrade", cell: touch.cell, multiplier: "double" },
          };
        }
        return startPending(touch.cell, touch.t);
      }

      // Fresh press on an idle board (or a stray repeated "down" on an already-down cell).
      return startPending(touch.cell, touch.t);
    }

    case "up": {
      if (state.phase !== "pending" || state.cell !== touch.cell || !state.isDown) {
        return { state }; // stray release — nothing pending for this cell
      }
      if (touch.t - state.downAt >= HOLD_MS) {
        // Held past the threshold and only now released: still a treble. In practice the caller's
        // timer fires holdElapsed at the threshold, before this can happen — this is a safety net
        // against timer jitter, not the primary path.
        return {
          state: { phase: "idle" },
          emit: { kind: "upgrade", cell: touch.cell, multiplier: "treble" },
        };
      }
      // Stay pending: the window is still open for a possible re-tap.
      return { state: { ...state, isDown: false } };
    }

    case "holdElapsed": {
      if (state.phase !== "pending" || state.cell !== touch.cell) {
        return { state }; // already resolved — a different cell took over, or it upgraded
      }
      if (!state.isDown) {
        // Released before the hold fired — already a single; the window just closes.
        return { state: { phase: "idle" } };
      }
      return {
        state: { phase: "idle" },
        emit: { kind: "upgrade", cell: touch.cell, multiplier: "treble" },
      };
    }
  }
}
