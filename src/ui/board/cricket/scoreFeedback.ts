import { type Dart, isMiss, marks } from "@/core/board";
import type { GameEvent } from "@/core/game/events";

import { PALETTE } from "@/ui/theme/palette";

/**
 * The floating-popup text + semantic flash color for a landed cricket dart, derived from the
 * events that dart produced. Driving it off events (not the tap that made it) means a bot's dart
 * and the bottom-bar MISS get exactly the same feedback a human tap does, without the UI needing
 * to know the pre-dart board state.
 *
 * Mirrors the original's rules: a miss is MISS; a dart that scored points (a `dartScored` event —
 * only happens once the thrower has closed the number) shows those points; a hit on a dead number
 * (a `marked` with 0 new marks and nothing scored) shows CAP!; anything else shows the mark count
 * (x1/x2/x3). Colored by the dart's multiplier.
 */

export interface CricketScoreFeedback {
  readonly text: string;
  readonly color: string;
  /** The seat that threw it (from the dart's events), or null if it can't be determined. */
  readonly seat: number | null;
}

function seatOf(events: readonly GameEvent[]): number | null {
  for (const e of events) {
    if ("seat" in e) return e.seat;
  }
  return null;
}

export function cricketFeedbackFromEvents(
  dart: Dart,
  events: readonly GameEvent[],
): CricketScoreFeedback {
  const seat = seatOf(events);

  // A miss is anything the engine scored as `dartMissed` — the literal MISS dart AND a bed on a
  // number that isn't on the cricket sheet (e.g. a bot's stray single-3), which isMiss() alone
  // wouldn't catch.
  if (isMiss(dart) || events.some((e) => e.type === "dartMissed")) {
    return { text: "MISS", color: PALETTE.redLight, seat };
  }

  const m = marks(dart);
  const color = m === 1 ? PALETTE.single : m === 2 ? PALETTE.double : PALETTE.treble;

  const scored = events.find((e) => e.type === "dartScored");
  if (scored?.type === "dartScored") return { text: String(scored.points), color, seat };

  const marked = events.find((e) => e.type === "marked");
  if (marked?.type === "marked" && marked.marks === 0) {
    return { text: "CAP!", color: PALETTE.redLight, seat };
  }

  return { text: `x${m}`, color, seat };
}
