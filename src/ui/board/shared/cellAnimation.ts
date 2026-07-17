/**
 * Pure ratio-at-elapsed-ms math for the cell press/hit animations — ported from
 * ScoreButton's runTouchAnimation/runHitAnimation. Kept framework-free (no
 * Animated/Skia) so the shape is unit-testable with synthetic timings, same division
 * of labor as dartGesture.ts vs useDartGesture.ts. Generic across every game's board —
 * useCellAnimations.ts drives an Animated.Value from these each frame.
 */

/** Light-up: 150ms, blends toward white on press-down (0→0.5), back on release (→0). */
export const LIGHT_UP_MS = 150;
export const LIGHT_UP_PEAK = 0.5;

/** Light PULSE: a self-contained white up-then-down (0→0.5→0) over 300ms, fired on touch-down
 * and NOT tied to when the finger lifts — so even a fast tap plays the whole glow, which is what
 * makes the press feel instant and complete. The colored hit-flash follows once the gesture
 * resolves. */
export const LIGHT_PULSE_MS = 2 * LIGHT_UP_MS;

/** Hit flash: 400ms, blends toward a semantic color in a rise-then-fall triangle wave
 * (peaks at 0.8 at the midpoint), not a linear ramp — a quick flash-and-fade. */
export const HIT_FLASH_MS = 400;
export const HIT_FLASH_PEAK = 0.8;
const HIT_FLASH_PEAK_AT_MS = HIT_FLASH_MS / 2;

/** A fast-out/linear-in-shaped ease: quick initial move, settling toward a steady
 * pace — an approximation of Android's FastOutLinearInInterpolator (exact curve
 * fidelity isn't verifiable without a device; the shape is what matters here). */
function fastOutLinearIn(t: number): number {
  return Math.sqrt(Math.min(1, Math.max(0, t)));
}

/** The light-up/light-down blend ratio `elapsedMs` into a 150ms transition from
 * `from` to `to` (0→0.5 for light-up, current→0 for light-down). */
export function lightUpRatioAt(elapsedMs: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / LIGHT_UP_MS));
  return from + (to - from) * fastOutLinearIn(t);
}

/** The light-pulse blend ratio `elapsedMs` into the 300ms pulse: up 0→0.5 over the first half
 * (fast-out-linear-in), back 0.5→0 over the second. Zero outside [0, LIGHT_PULSE_MS). */
export function lightPulseRatioAt(elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= LIGHT_PULSE_MS) return 0;
  if (elapsedMs < LIGHT_UP_MS) return lightUpRatioAt(elapsedMs, 0, LIGHT_UP_PEAK);
  return lightUpRatioAt(elapsedMs - LIGHT_UP_MS, LIGHT_UP_PEAK, 0);
}

/** The hit-flash blend ratio `elapsedMs` into a 400ms flash: rises linearly to 0.8 at
 * 200ms, falls linearly back to 0 by 400ms. Zero outside [0, HIT_FLASH_MS). */
export function hitFlashRatioAt(elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= HIT_FLASH_MS) return 0;
  if (elapsedMs <= HIT_FLASH_PEAK_AT_MS) {
    return (elapsedMs / HIT_FLASH_PEAK_AT_MS) * HIT_FLASH_PEAK;
  }
  return ((HIT_FLASH_MS - elapsedMs) / HIT_FLASH_PEAK_AT_MS) * HIT_FLASH_PEAK;
}
