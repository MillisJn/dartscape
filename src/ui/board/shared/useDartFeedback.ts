import { useEffect, useRef } from "react";

import type { Dart } from "@/core/board";
import type { GameEvent } from "@/core/game/events";

/**
 * The general "a dart just landed" trigger, shared by every board. Fires `onDart` exactly once
 * per new dart — whoever threw it (a human tap, a bot's timer, the MISS button all just append to
 * the same log) — with the dart and the events it produced. That's the whole seam between the
 * store growing and a board showing feedback (a floating popup, a cell flash), so a board never
 * has to know a dart's *source*, only that one landed and what it did.
 *
 * `dartCount` (the log length) is the change signal, not the dart/events objects: those get a
 * fresh identity on every unrelated re-render, so watching them would refire endlessly. They're
 * read fresh from a ref at the moment the count actually changes — same pattern as useGameEvents.
 * `onDart` must be stable (useCallback) so a board's own re-renders don't retrigger it.
 */
export function useDartFeedback(
  dartCount: number,
  latest: { readonly dart: Dart | null; readonly events: readonly GameEvent[] },
  onDart: (dart: Dart, events: readonly GameEvent[]) => void,
): void {
  const latestRef = useRef(latest);
  latestRef.current = latest;
  const lastCountRef = useRef(dartCount);

  useEffect(() => {
    if (dartCount === lastCountRef.current) return;
    lastCountRef.current = dartCount;
    const { dart, events } = latestRef.current;
    if (dart) onDart(dart, events);
  }, [dartCount, onDart]);
}
