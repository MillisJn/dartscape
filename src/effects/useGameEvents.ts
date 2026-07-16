import { showAppToast } from "@spatch-kit/ui/overlays/system/appFeedbackController";
import { useEffect, useRef } from "react";
import type { GameEvent } from "@/core/game/events";

import { playSound } from "./sound";

function assertNever(x: never): never {
  throw new Error(`unhandled event: ${JSON.stringify(x)}`);
}

/** The exhaustive mapping, exported separately from the hook so it's testable with no React
 * render — see useGameEvents.test.ts. */
export function applyGameEvent(event: GameEvent): void {
  switch (event.type) {
    case "dartScored":
      playSound("dartScored");
      break;
    case "dartMissed":
      break;
    case "visitEnded":
      break;
    case "roundEnded":
      break;
    case "won":
      playSound("won");
      break;
    case "bust":
      playSound("bust");
      showAppToast({ message: "BUST!" });
      break;
    case "notOpenedYet":
      break;
    case "opened":
      break;
    case "checkout":
      showAppToast({ message: "CHECKOUT!" });
      break;
    case "marked":
      // Cricket's per-dart click — every target hit emits `marked` (even a mark:0 hit on a
      // number you've already closed), so this is the reliable "a dart landed" signal that
      // makes the sheet audibly responsive, mirroring the original's per-hit DART sound.
      playSound("dartScored");
      break;
    case "targetClosed":
      playSound("targetClosed");
      break;
    case "targetDead":
      break;
    case "shanghai":
      showAppToast({ message: "SHANGHAI!" });
      break;
    case "baseHit":
      break;
    case "homeRun":
      playSound("homeRun");
      showAppToast({ message: "HOME RUN!" });
      break;
    case "grandSlam":
      showAppToast({ message: "GRAND SLAM!" });
      break;
    case "out":
      break;
    case "inningEnded":
      break;
    case "numberClaimed":
      break;
    case "becameKiller":
      showAppToast({ message: "KILLER!" });
      break;
    case "lostKillerStatus":
      break;
    case "lifeLost":
      break;
    case "eliminated":
      showAppToast({ message: "ELIMINATED" });
      break;
    default:
      assertNever(event);
  }
}

/**
 * The exhaustive switch over GameEvent -> the world (sound, a toast). A new event type fails to
 * compile until it's handled here — see assertNever. Subscribes to whatever the log's last dart
 * produced; core/ never imports this (core-isolation.test.ts enforces it).
 *
 * `dartCount` (the log length) is the change signal, not `events` itself — reduce() hands back a
 * *new* events array on every call regardless of whether the log actually grew, so watching the
 * array would replay the same events on every unrelated re-render. `events` is still read fresh
 * (via a ref) at the moment `dartCount` actually changes.
 *
 * `onWon` is a separate callback (not just another case here) because "a leg was won" needs to
 * open the results modal — real navigation/state the effects layer itself shouldn't own.
 */
export function useGameEvents(
  events: readonly GameEvent[],
  dartCount: number,
  onWon?: (seat: number) => void,
): void {
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const lastCountRef = useRef(dartCount);

  useEffect(() => {
    if (dartCount === lastCountRef.current) return;
    lastCountRef.current = dartCount;

    for (const event of eventsRef.current) {
      applyGameEvent(event);
      if (event.type === "won") onWon?.(event.seat);
    }
  }, [dartCount, onWon]);
}
