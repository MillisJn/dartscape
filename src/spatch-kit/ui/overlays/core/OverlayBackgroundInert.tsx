import type { ReactNode } from "react";
import { Platform, View } from "react-native";

import { useHasInertExempt } from "./inertExemptPresence";
import { useHasActiveOverlay } from "./dismissal";

// Replaces the inert-background behavior native <Modal> gave for free. While a BLOCKING content
// overlay (any non-"top" tier) is interactive, the in-place shell tree is marked
// `no-hide-descendants` so screen readers don't traverse behind the overlay. Teleported overlays
// live in <OverlayHost>, a SIBLING of this wrapper, so they are NOT inerted — only the shell is.
// (iOS gets its single-owner modal trap via accessibilityViewIsModal in OverlayPortal.native;
// this wrapper is the Android counterpart. `importantForAccessibility` is a no-op on web.)
//
// EXCEPTION — inert-exempt content (today: native maps): toggling importantForAccessibility on an
// ancestor of a native Google MapView (a SurfaceView) makes the map flicker hard on Android every
// time an overlay opens/closes (react-native-maps #5743). Anything that can't survive the prop
// reports itself via useReportInertExempt; while one is mounted we leave the prop at "auto" and skip
// the Android inert. iOS keeps its accessibilityViewIsModal trap; unaffected screens are unchanged.
// See inertExemptPresence for why the register lives here rather than in maps/.
export function OverlayBackgroundInert({ children }: { children: ReactNode }) {
  const blocked = useHasActiveOverlay({ excludeTier: "top" });
  const hasInertExempt = useHasInertExempt();
  const inert = blocked && !(Platform.OS === "android" && hasInertExempt);
  return (
    <View
      style={{ flex: 1 }}
      importantForAccessibility={inert ? "no-hide-descendants" : "auto"}
    >
      {children}
    </View>
  );
}
