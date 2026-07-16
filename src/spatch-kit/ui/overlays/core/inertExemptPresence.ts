import { useEffect } from "react";
import { useSyncExternalStore } from "react";

// "Is something on screen whose ancestors must NOT be marked inert?" — the overlay core's
// a11y-inerting exemption register.
//
// OverlayBackgroundInert marks the shell tree `no-hide-descendants` while a blocking overlay is
// interactive. On Android that prop is destructive to some native views, so anything that can't
// survive it reports itself here and the overlay core skips the inert while it's mounted.
//
// THE MOTIVATING CASE — native maps: toggling `importantForAccessibility` on an ancestor View of a
// native Google MapView (a SurfaceView) makes the map flicker hard on Android every time it changes,
// which is exactly what OverlayBackgroundInert does when an overlay opens/closes (react-native-maps
// #5743, closed-unplanned upstream). BaseMap calls useReportInertExempt while a MapView is up, so the
// prop stays at "auto" and the map never flickers. iOS keeps its accessibilityViewIsModal trap
// (OverlayPortal.native); `importantForAccessibility` is a no-op on web.
//
// WHY THIS LIVES IN THE OVERLAY CORE, NOT IN maps/: the inerting decision belongs to the overlay
// system, so the exemption register does too — the map is only a REPORTER. Inverting it this way
// keeps the overlay core free of any map import, and means an app with no maps needs no registration
// at all: nothing calls the reporter, the count stays 0, and the exemption is false structurally
// rather than by configuration. Named generically ("inert-exempt", not "native map") so a future
// non-map offender reports through the same register.

let count = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

// Report that this component's ancestors must not be inerted. Increments the mounted count while
// `active` is true and decrements on unmount / when it goes false.
export function useReportInertExempt(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    count += 1;
    emit();
    return () => {
      count -= 1;
      emit();
    };
  }, [active]);
}

export function useHasInertExempt(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => count > 0,
    () => false,
  );
}
