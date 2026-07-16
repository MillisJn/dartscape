import { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { PortalHost } from "@gorhom/portal";

import { dismissTopOverlay } from "./dismissal";
import { OVERLAY_HOST_NAME } from "./OverlayHost.types";

export type { OverlayHostComponent } from "./OverlayHost.types";

// `__DEV__` guard so this is also safe under plain node.
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;

// Dev-only single-host invariant: a second mount would split teleport targets ambiguously.
let mountedHosts = 0;

// The single, always-mounted in-tree overlay plane (native). One full-window box-none View
// holds the lone gorhom PortalHost every OverlayPortal teleports into, so stacking is governed
// by tier + insertion order in React — NOT by OS-modal presentation order. Mounted last in
// _layout so it paints above the shell. Owns the app's only overlay BackHandler.
export function OverlayHost() {
  useEffect(() => {
    mountedHosts += 1;
    if (IS_DEV && mountedHosts > 1) {
      console.error(
        "[overlay] Multiple <OverlayHost> mounted — there must be exactly one, or " +
          "teleport targets and stacking become ambiguous.",
      );
    }
    return () => {
      mountedHosts -= 1;
    };
  }, []);

  // The app's single overlay back handler. Dismisses the topmost back-dismissable interactive
  // layer (one per press) and consumes the event; falls through to navigation when none.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () =>
      dismissTopOverlay(),
    );
    return () => subscription.remove();
  }, []);

  // box-none: when nothing (or only click-through content) is mounted, touches pass to the
  // shell beneath. Each overlay re-enables capture via its own fill wrapper / backdrop.
  //
  // elevation: on Android, `elevation` lifts a view in the z-buffer regardless of sibling draw
  // order, so any elevated shell control (the FAB, bottom bar, buttons) would otherwise render ON
  // TOP of overlays — the overlays used to out-elevate them, but they now use boxShadow (no
  // elevation). Lifting the whole transparent plane above the max shell elevation restores the
  // correct stacking without giving any overlay an elevation shadow of its own. No-op off Android.
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { elevation: OVERLAY_PLANE_ELEVATION }]}
    >
      <PortalHost name={OVERLAY_HOST_NAME} />
    </View>
  );
}

// Higher than any elevated shell control (FAB was the tallest at 16) so the overlay plane always
// wins the Android z-buffer.
const OVERLAY_PLANE_ELEVATION = 24;
