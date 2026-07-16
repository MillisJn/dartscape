import { useCallback, useEffect, useRef, useState } from "react";

import {
  closeTooltip,
  isTooltipActive,
  isTooltipWarm,
  nextTooltipId,
  openTooltip,
  relinquishTooltip,
  subscribeTooltip,
} from "./tooltipController";

// Hover-intent delay before a tooltip opens from a cold start — long enough that a pointer merely
// passing over a button doesn't flash a bubble.
const OPEN_DELAY_MS = 450;
// Once one tooltip is (or was just) open, neighbors open almost immediately.
const WARM_DELAY_MS = 60;
const WARM_WINDOW_MS = 300;

type TooltipState = {
  visible: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
};

// Owns a single button's tooltip open/close lifecycle: the hover-intent timer, the one-at-a-time
// coordination via tooltipController, and cleanup so a fast hover-then-navigate never opens a bubble
// on an unmounted button. `enabled` gates everything (web + preference on + has a label) — when
// false the handlers are inert and `visible` stays false.
export function useTooltipState(enabled: boolean): TooltipState {
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) {
    idRef.current = nextTooltipId();
  }
  const id = idRef.current;

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Another tooltip taking over closes this one immediately.
  useEffect(() => {
    return subscribeTooltip((activeId) => {
      if (activeId !== id) {
        clearTimer();
        setVisible(false);
      }
    });
  }, [id]);

  // On unmount: drop the timer and relinquish the singleton if we held it (teardown — must not warm
  // the next open).
  useEffect(() => {
    return () => {
      clearTimer();
      relinquishTooltip(id);
    };
  }, [id]);

  // When the anchor is disabled or the preference is turned off mid-life, synchronously cancel any
  // pending open, hide, and relinquish the singleton — so a queued timer can't set a phantom active
  // id and the controller state is clean. `visible && enabled` already hides the bubble; this closes
  // the pending/controller residual without warming a later open.
  useEffect(() => {
    if (enabled) return;
    clearTimer();
    setVisible(false);
    relinquishTooltip(id);
  }, [enabled, id]);

  const onHoverIn = useCallback(() => {
    if (!enabled) return;
    clearTimer();
    const delay = isTooltipWarm(WARM_WINDOW_MS) ? WARM_DELAY_MS : OPEN_DELAY_MS;
    timerRef.current = setTimeout(() => {
      openTooltip(id);
      setVisible(true);
    }, delay);
  }, [enabled, id]);

  const onHoverOut = useCallback(() => {
    clearTimer();
    if (isTooltipActive(id)) {
      closeTooltip(id);
    }
    setVisible(false);
  }, [id]);

  return { visible: visible && enabled, onHoverIn, onHoverOut };
}
