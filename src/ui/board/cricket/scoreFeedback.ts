import { type Dart, isMiss, marks } from "@/core/board";

import { PALETTE } from "@/ui/theme/palette";

/**
 * Derives the floating-popup text + semantic flash color for a landed cricket dart —
 * a direct port of ScoreButton.popSoundAnimate()'s text/color rules, computed
 * entirely in the UI layer from the Dart the gesture already produced (plus whether
 * the row was already closed by everyone) so the engine/reducer stays untouched.
 */

export interface CricketScoreFeedback {
  readonly text: string;
  readonly color: string;
}

export function cricketScoreFeedback(dart: Dart, wasDead: boolean): CricketScoreFeedback {
  if (isMiss(dart)) return { text: "MISS", color: PALETTE.redLight };
  if (wasDead) return { text: "CAP!", color: PALETTE.redLight };

  const m = marks(dart);
  const color = m === 1 ? PALETTE.single : m === 2 ? PALETTE.double : PALETTE.treble;
  return { text: `x${m}`, color };
}
