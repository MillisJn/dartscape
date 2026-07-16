import { useContext, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Portal } from "@gorhom/portal";

import { useIsA11yModalOwner, useOverlayLayer } from "./dismissal";
import { OverlayLayerIdProvider } from "./overlayLayerContext";
import { OverlayHostReadyContext, OVERLAY_HOST_NAME } from "./OverlayHost.types";
import { OverlayLayerBoundary } from "./OverlayLayerBoundary";
import { DEFAULT_OVERLAY_TIER, tierZ } from "./overlayTiers";
import type { OverlayPortalProps } from "./OverlayPortal.types";

export type { OverlayPortalProps } from "./OverlayPortal.types";

// ─── OverlayPortal (native) — PERMANENT INVARIANTS (do not erode) ───────────────────────────
// • SINGLE HOST: every overlay teleports into the one <OverlayHost> PortalHost. There is no
//   per-overlay OS <Modal> anymore — that's why the assistant can stay pinned on top (OS modals
//   stack by presentation order and z-index can't cross that boundary; a single in-tree plane
//   lets React control z-order).
// • OVERLAYPORTAL IS THE ONLY PUBLIC ABSTRACTION. `@gorhom/portal` is a PRIVATE implementation
//   detail — only this file and OverlayHost.native may import it (enforced by the arch guard).
// • EFFECT-ONLY REGISTRATION: layers register via useOverlayLayer in effects (never during
//   render), keyed by a stable id, so concurrent/StrictMode renders converge.
// • TIER ORDERING: stacking is tier (overlayTiers.ts) + insertion order. Nothing else.
// • NAVIGATOR-SCOPED CONTEXT MUST BE BRIDGED BY THE CONSUMER. gorhom renders teleported children
//   at the PortalHost's tree position, so context provided below <PortalProvider> is lost here —
//   consumers that need it use bridgeContexts (see bridgeContexts.ts). Root context (theme,
//   nativewind, safe-area) and the module `db` singleton survive and need no bridge.
// ────────────────────────────────────────────────────────────────────────────────────────────

const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;

export function OverlayPortal({
  visible,
  tier = DEFAULT_OVERLAY_TIER,
  active,
  backDismissable = true,
  decorative = false,
  children,
  onRequestClose,
  onShow,
  // animationType is intentionally ignored now (parity with web): overlays drive their own
  // transitions. Kept in the type for back-compat with existing call sites.
  pointerEvents = "box-none",
}: OverlayPortalProps) {
  const ready = useContext(OverlayHostReadyContext);
  const shown = visible && ready;
  const activeIntent = (active ?? visible) && ready;

  // Register this layer for back targeting / "has overlay" / a11y-owner selection. Decorative
  // overlays (click-through toasts) opt out entirely by registering as never-visible.
  const layerId = useOverlayLayer(!decorative && shown, !decorative && activeIntent, {
    tier,
    backDismissable,
    onRequestClose,
  });
  const isA11yOwner = useIsA11yModalOwner(layerId);

  // Fire onShow once the overlay is actually on screen (post-mount) — replaces the old Modal
  // present callback; gates entrance animations (e.g. AppAlertHost's `ready`).
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  useEffect(() => {
    if (shown) onShowRef.current?.();
  }, [shown]);

  // Fail safe: with no <PortalProvider>/<OverlayHost> ancestor, render nothing rather than let
  // gorhom's usePortal throw. (Structurally impossible in-app — host is mounted at the root.)
  useEffect(() => {
    if (visible && !ready && IS_DEV) {
      console.error(
        "[overlay] OverlayPortal rendered with no <PortalProvider>/<OverlayHost> ancestor; " +
          "the overlay will not be shown. Mount <OverlayHost> in the root layout.",
      );
    }
  }, [visible, ready]);

  if (!shown) {
    return null;
  }

  return (
    <Portal hostName={OVERLAY_HOST_NAME}>
      {/*
        STABLE KEY — REQUIRED. gorhom's PortalHost renders teleported layers as
        `state.map(item => item.node)` with NO key, so React reconciles them BY ARRAY INDEX. When an
        earlier layer's portal is removed (e.g. a popup menu closing as an alert opens — a handoff),
        every later layer shifts index and React REMOUNTS it — resetting its animations (the alert
        backdrop disappears/reappears, the card re-pops). Keying each layer by its stable layerId
        makes React reconcile by identity instead, so removing one layer never remounts the others.
      */}
      <OverlayLayerBoundary
        key={layerId}
        overlayId={layerId}
        tier={tier}
        resetKeys={[layerId, visible]}
      >
        <View
          accessibilityViewIsModal={isA11yOwner || undefined}
          pointerEvents={pointerEvents}
          style={[StyleSheet.absoluteFill, { zIndex: tierZ(tier) }]}
        >
          {/* Tag this overlay's subtree with its layer id so a keyboard-aware scroll inside it knows
              whether the keyboard belongs to it (topmost) or to a higher overlay stacked above. */}
          <OverlayLayerIdProvider value={layerId}>
            {children}
          </OverlayLayerIdProvider>
        </View>
      </OverlayLayerBoundary>
    </Portal>
  );
}
