import { useCallback, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";

import type { Dart } from "@/core/board";

import {
  type GestureState,
  HOLD_MS,
  IDLE_GESTURE,
  type Multiplier,
  reduceGesture,
} from "./dartGesture";

/**
 * The thin React wrapper over the pure state machine — feeds it real touches and a real clock.
 * Reusable across panels: each one supplies its own hit-testing and its own cellId -> Dart mapping
 * (a wedge for X01's grid, a different target shape for another panel's escalating cells), and this
 * hook owns the touch tracking, the HOLD_MS timer, and driving reduceGesture.
 */

export interface DartGestureTarget {
  /** A stable numeric id for this escalating cell — e.g. a Wedge, or a panel-specific sentinel. */
  readonly cellId: number;
  toDart(multiplier: Multiplier): Dart;
}

export interface UseDartGestureOptions {
  /** Point -> the escalating target under it, or null. */
  hitTest(point: { readonly x: number; readonly y: number }): DartGestureTarget | null;
  /** A single-action cell (BUST, a miss button, ...): fires immediately on release, no escalation. */
  hitTestAction(point: { readonly x: number; readonly y: number }): Dart | null;
  /** The instant single landing on press. */
  onLand(dart: Dart): void;
  /** A double/treble upgrade — the caller pops the previous dart and pushes this one. */
  onUpgrade(dart: Dart): void;
  /** Fired the instant a touch goes down on a cell (escalating or action) — for
   * press-visual feedback (a light-up flash) independent of whether it lands a dart.
   * Action cells report ACTION_CELL. Optional: panels with no such feedback omit it. */
  onPressStart?(cellId: number): void;
  /** Fired when that same touch releases — pairs with onPressStart. */
  onPressEnd?(cellId: number): void;
  /** Injectable for tests; defaults to the real clock. */
  now?(): number;
}

/** The cellId reported to onPressStart/onPressEnd for an action cell — hitTestAction
 * returns a Dart, not a cellId, so callers that care which cell get this sentinel. */
export const ACTION_CELL = -1;

export function useDartGesture({
  hitTest,
  hitTestAction,
  onLand,
  onUpgrade,
  onPressStart,
  onPressEnd,
  now = Date.now,
}: UseDartGestureOptions) {
  const stateRef = useRef<GestureState>(IDLE_GESTURE);
  const targetsRef = useRef(new Map<number, DartGestureTarget>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const apply = useCallback(
    (touch: Parameters<typeof reduceGesture>[1]) => {
      const result = reduceGesture(stateRef.current, touch);
      stateRef.current = result.state;

      if (result.emit) {
        const target = targetsRef.current.get(result.emit.cell);
        if (target) {
          if (result.emit.kind === "land") onLand(target.toDart("single"));
          else onUpgrade(target.toDart(result.emit.multiplier));
        }
      }

      clearTimer();
      if (result.state.phase === "pending" && result.state.isDown) {
        const cell = result.state.cell;
        timerRef.current = setTimeout(() => {
          apply({ kind: "holdElapsed", cell, t: now() });
        }, HOLD_MS);
      }
    },
    [clearTimer, now, onLand, onUpgrade],
  );

  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .onTouchesDown((e) => {
          const touch = e.changedTouches[0];
          if (!touch) return;
          const point = { x: touch.x, y: touch.y };

          // Single-action cells (BUST) fire on release, not on down — see hitTestAction's caller.
          if (hitTestAction(point)) {
            onPressStart?.(ACTION_CELL);
            return;
          }

          const target = hitTest(point);
          if (!target) return;
          targetsRef.current.set(target.cellId, target);
          onPressStart?.(target.cellId);
          apply({ kind: "down", cell: target.cellId, t: now() });
        })
        .onTouchesUp((e) => {
          // Resolve whichever cell this touch went down on, regardless of exact release
          // coordinates — the initiating press is what matters, not minor finger drift.
          if (stateRef.current.phase === "pending") {
            const cell = stateRef.current.cell;
            apply({ kind: "up", cell, t: now() });
            onPressEnd?.(cell);
            return;
          }

          // Nothing was pending: this release might be a single-action cell firing.
          const touch = e.changedTouches[0];
          if (!touch) return;
          const action = hitTestAction({ x: touch.x, y: touch.y });
          if (action) {
            onPressEnd?.(ACTION_CELL);
            onLand(action);
          }
        })
        .runOnJS(true),
    [apply, hitTest, hitTestAction, now, onLand, onPressStart, onPressEnd],
  );

  return gesture;
}
