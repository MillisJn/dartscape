import { useCallback, useRef, useState } from "react";

/**
 * Local popup queue for the floating score text — a small self-contained overlay,
 * deliberately not built on the app's overlays/ system (that's for backdrop-dismissable
 * modals/dropdowns; this needs touch-transparent, self-timed, rect-anchored). Mounted
 * once per grid; `show()` is called from wherever a dart lands.
 */

export interface ScorePopupRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScorePopupEntry {
  readonly id: number;
  readonly text: string;
  readonly color: string;
  readonly rect: ScorePopupRect;
}

export interface ScorePopups {
  readonly popups: readonly ScorePopupEntry[];
  show(text: string, color: string, rect: ScorePopupRect): void;
}

/** Matches TextPopup's postDelayed(dismiss, 1400) auto-dismiss. */
const AUTO_DISMISS_MS = 1400;

export function useScorePopups(): ScorePopups {
  const [popups, setPopups] = useState<readonly ScorePopupEntry[]>([]);
  const nextId = useRef(0);

  const show = useCallback((text: string, color: string, rect: ScorePopupRect) => {
    const id = nextId.current++;
    setPopups((prev) => [...prev, { id, text, color, rect }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return { popups, show };
}
