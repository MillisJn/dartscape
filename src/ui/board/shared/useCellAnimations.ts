import { useTheme } from "@spatch-kit/theme/provider";
import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  HIT_FLASH_MS,
  hitFlashRatioAt,
  LIGHT_PULSE_MS,
  LIGHT_UP_MS,
  LIGHT_UP_PEAK,
  lightPulseRatioAt,
  lightUpRatioAt,
} from "./cellAnimation";

/**
 * Drives the light-up (press) and hit-flash (score) animations for every cell in a
 * board — cricket's per-seat columns today, any other game's escalating cells later —
 * one requestAnimationFrame loop shared across all of them, mirrors ScoreButton's
 * per-button mBlendRatio/mBlendColor. Keyed by an abstract row/cell index rather than
 * one hook call per cell, since a board's cell count is a runtime value, not
 * something that can be literally unrolled into fixed hook calls.
 */

type AnimationKind = "lightUp" | "lightDown" | "hitFlash" | "lightPulse";

interface RunningAnimation {
  readonly kind: AnimationKind;
  readonly startedAt: number;
  readonly from: number;
}

const DEFAULT_BLEND_COLOR = "#FFFFFF";

export interface CellAnimations {
  /** 0..1 blend strength toward blendColorOf(row) — 0 means "no blend, draw plain". */
  ratioOf(row: number): number;
  blendColorOf(row: number): string;
  /** Refuses to start while a hit-flash is running on this row — mirrors the original. */
  lightUp(row: number): void;
  lightDown(row: number): void;
  /** A self-contained white up-then-down glow fired on touch-down. Unlike lightUp/lightDown it
   * isn't tied to the release, so even a quick tap plays the whole pulse. */
  pulse(row: number): void;
  /** Cancels any running light-up on this row first — mirrors the original. */
  hitFlash(row: number, color: string): void;
}

export function useCellAnimations(): CellAnimations {
  const theme = useTheme();
  const motionEnabled = theme.motion.enabled;

  const runningRef = useRef(new Map<number, RunningAnimation>());
  const ratiosRef = useRef(new Map<number, number>());
  const colorsRef = useRef(new Map<number, string>());
  const rafRef = useRef<number | null>(null);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    let anyRunning = false;

    for (const [row, running] of runningRef.current) {
      const elapsed = now - running.startedAt;

      if (running.kind === "hitFlash") {
        if (elapsed >= HIT_FLASH_MS) {
          ratiosRef.current.set(row, 0);
          runningRef.current.delete(row);
          continue;
        }
        ratiosRef.current.set(row, hitFlashRatioAt(elapsed));
        anyRunning = true;
        continue;
      }

      if (running.kind === "lightPulse") {
        if (elapsed >= LIGHT_PULSE_MS) {
          ratiosRef.current.set(row, 0);
          runningRef.current.delete(row);
          continue;
        }
        ratiosRef.current.set(row, lightPulseRatioAt(elapsed));
        anyRunning = true;
        continue;
      }

      const to = running.kind === "lightUp" ? LIGHT_UP_PEAK : 0;
      if (elapsed >= LIGHT_UP_MS) {
        ratiosRef.current.set(row, to);
        runningRef.current.delete(row);
        continue;
      }
      ratiosRef.current.set(row, lightUpRatioAt(elapsed, running.from, to));
      anyRunning = true;
    }

    forceRender();
    rafRef.current = anyRunning ? requestAnimationFrame(tick) : null;
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const start = useCallback(
    (row: number, kind: AnimationKind, color: string) => {
      colorsRef.current.set(row, color);
      const from = ratiosRef.current.get(row) ?? 0;

      if (!motionEnabled) {
        ratiosRef.current.set(row, kind === "lightUp" ? LIGHT_UP_PEAK : 0);
        runningRef.current.delete(row);
        forceRender();
        return;
      }

      // A hit-flash and a pulse always start fresh from 0, matching the original's
      // setBlendRatio(0) before animating — a light-up/light-down continues from
      // wherever the ratio currently sits (e.g. re-entering bounds mid-drag).
      const fresh = kind === "hitFlash" || kind === "lightPulse";
      if (fresh) ratiosRef.current.set(row, 0);
      runningRef.current.set(row, {
        kind,
        startedAt: Date.now(),
        from: fresh ? 0 : from,
      });
      ensureLoop();
    },
    [ensureLoop, motionEnabled],
  );

  const lightUp = useCallback(
    (row: number) => {
      if (runningRef.current.get(row)?.kind === "hitFlash") return;
      start(row, "lightUp", DEFAULT_BLEND_COLOR);
    },
    [start],
  );

  const lightDown = useCallback(
    (row: number) => {
      if (runningRef.current.get(row)?.kind === "hitFlash") return;
      start(row, "lightDown", DEFAULT_BLEND_COLOR);
    },
    [start],
  );

  // Always starts (a press should never go unacknowledged) — the self-contained white pulse.
  const pulse = useCallback(
    (row: number) => start(row, "lightPulse", DEFAULT_BLEND_COLOR),
    [start],
  );

  const hitFlash = useCallback(
    (row: number, color: string) => start(row, "hitFlash", color),
    [start],
  );

  useEffect(() => stopLoop, [stopLoop]);

  const ratioOf = useCallback((row: number) => ratiosRef.current.get(row) ?? 0, []);
  const blendColorOf = useCallback(
    (row: number) => colorsRef.current.get(row) ?? DEFAULT_BLEND_COLOR,
    [],
  );

  return { ratioOf, blendColorOf, lightUp, lightDown, pulse, hitFlash };
}
