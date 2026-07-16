import { type Dart, isMiss, marks, points } from "@/core/board";

import { PALETTE } from "@/ui/theme/palette";

/**
 * Derives the floating-popup text + semantic flash color for a landed cricket dart —
 * computed entirely in the UI layer from the Dart the gesture already produced (plus
 * whether the row was already closed by everyone, and by the thrower) so the
 * engine/reducer stays untouched. Marks-only hits (nothing on the score yet) show the
 * mark count (`x1`/`x2`/`x3`); once the thrower has already closed the number, further
 * hits are pure points, so the popup shows the points instead.
 */

export interface CricketScoreFeedback {
  readonly text: string;
  readonly color: string;
}

export function cricketScoreFeedback(
  dart: Dart,
  wasDead: boolean,
  wasClosedByThrower: boolean,
): CricketScoreFeedback {
  if (isMiss(dart)) return { text: "MISS", color: PALETTE.redLight };
  if (wasDead) return { text: "CAP!", color: PALETTE.redLight };

  const m = marks(dart);
  const color = m === 1 ? PALETTE.single : m === 2 ? PALETTE.double : PALETTE.treble;
  const text = wasClosedByThrower ? String(points(dart)) : `x${m}`;
  return { text, color };
}
