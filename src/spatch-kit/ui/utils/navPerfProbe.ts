// DEV-ONLY tab-switch latency probe. Measures, for a bottom-bar tab switch:
//   commit = press -> incoming screen's React commit (useLayoutEffect, before paint)
//   paint  = press -> the next frame after commit (requestAnimationFrame, ~ when it's on screen)
//
// Reading the two apart tells us WHERE a slow switch lives:
//   - commit already large        -> the JS bottom-tabs pipeline (dispatch + re-render) is the cost
//   - commit small, paint large   -> the native commit/paint over the heavy attached tree is the cost
//
// Wired from the bottom bar (markNavStart) + each hot tab screen (useNavArrivalProbe). Fully no-op in
// production (every entry point early-returns on !__DEV__). Remove once the switch is fast.
import { useEffect, useLayoutEffect, useRef } from "react";
import { useIsFocused } from "expo-router/react-navigation";

type PendingNav = { label: string; t0: number };

// Labels that have mounted at least once this session. A screen that appears here again on mount is
// RE-MOUNTING (it wasn't kept warm) — the decisive signal for a persistently slow, never-warming tab.
const everMounted = new Set<string>();

// Only one bottom-bar switch is ever in flight at a time, so a single slot is enough. A press that
// resolves to the current route (no focus change) leaves this set until the next real switch consumes
// it — harmless, since the elapsed time is only logged against a genuine focus gain.
let pending: PendingNav | null = null;

function now(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

// Called from the bottom bar the instant a tab is pressed (before navigateHref).
export function markNavStart(label: string): void {
  if (!__DEV__) {
    return;
  }
  pending = { label, t0: now() };
}

// Called by each hot tab screen. Fires once each time the screen gains focus; if a bottom-bar press is
// pending, logs the press -> commit and press -> paint elapsed for that switch.
export function useNavArrivalProbe(label: string): void {
  const wasFocused = useRef(false);
  const isFocused = useIsFocused();

  // Mount/re-mount detector: runs once per actual mount. If this label already mounted this session,
  // the screen was torn down and rebuilt (NOT kept warm) — which fully explains a tab that never warms.
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    const remount = everMounted.has(label);
    everMounted.add(label);
    console.log(
      `[nav-probe] ${label} ${remount ? "RE-MOUNT (not warm!)" : "first mount"}`,
    );
  }, [label]);

  useLayoutEffect(() => {
    if (!__DEV__) {
      return;
    }
    const gainedFocus = isFocused && !wasFocused.current;
    wasFocused.current = isFocused;
    if (!gainedFocus) {
      return;
    }
    const started = pending;
    if (!started) {
      return;
    }
    pending = null;
    const commitMs = now() - started.t0;
    requestAnimationFrame(() => {
      const paintMs = now() - started.t0;
      console.log(
        `[nav-probe] ${started.label} -> ${label}  commit=${commitMs.toFixed(
          0,
        )}ms  paint=${paintMs.toFixed(0)}ms`,
      );
    });
  }, [isFocused, label]);
}
