import { createPortal } from "react-dom";
import { View, type ViewStyle } from "react-native";

import { buildNativeWindThemeVars } from "@spatch-kit/theme/nativewind";
import { useTheme } from "@spatch-kit/theme/provider";

import { useOverlayLayer } from "./dismissal";
import { OverlayLayerIdProvider } from "./overlayLayerContext";
import { DEFAULT_OVERLAY_TIER, tierZ } from "./overlayTiers";
import type { OverlayPortalProps } from "./OverlayPortal.types";

export type { OverlayPortalProps } from "./OverlayPortal.types";

// Single top-level container appended to <body>, OUTSIDE Expo's #root app tree. Because nothing
// above it carries a CSS `transform`, `position: fixed` inside resolves against the viewport and
// its z-index competes at the document root — which frees web overlays from the ancestor
// stacking-context / transform-containment trap that buried them behind other controls.
const OVERLAY_ROOT_ID = "fp-overlay-root";

// `pointer-events: none` so the layer never blocks the page on its own; each overlay's children
// re-enable input where needed (see the box-none fill below).
function getOverlayRoot(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  let root = document.getElementById(OVERLAY_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ROOT_ID;
    root.style.position = "fixed";
    root.style.top = "0";
    root.style.left = "0";
    root.style.right = "0";
    root.style.bottom = "0";
    root.style.zIndex = "1000";
    root.style.pointerEvents = "none";
    document.body.appendChild(root);
  }

  return root;
}

// Mirror the app's NativeWind theme variables onto the overlay root. On web, NativeWind utilities
// resolve `var(--fp-*)` purely through the DOM cascade, and this portal target lives on <body>,
// OUTSIDE the app's VariableContextProvider wrapper — so without these vars every themed utility
// (bg-surface, rounded-app-lg, p-app-md, border-border, …) computes invalid and overlays render
// completely unstyled. We set the vars DIRECTLY on the root div (rather than via a wrapper element)
// so absolute-positioned children — e.g. the account menu's `right: 8` — still resolve against the
// full-viewport fill below, not an intermediary box that would mis-anchor them.
function applyThemeVars(root: HTMLElement, vars: Record<string, string>) {
  for (const key of Object.keys(vars)) {
    root.style.setProperty(key, vars[key]);
  }
}

const FILL_STYLE: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

export function OverlayPortal({
  visible,
  tier = DEFAULT_OVERLAY_TIER,
  active,
  backDismissable = true,
  decorative = false,
  children,
  onRequestClose,
  pointerEvents = "box-none",
}: OverlayPortalProps) {
  const theme = useTheme();

  // Register the layer too (web has no hardware back, but this powers useHasActiveOverlay —
  // the assistant's collapse-to-pill — identically on both platforms). web createPortal
  // preserves tree context, so no bridge is needed here. Decorative overlays (toasts) opt out.
  const layerId = useOverlayLayer(
    !decorative && visible,
    !decorative && (active ?? visible),
    {
      tier,
      backDismissable,
      onRequestClose,
    },
  );

  if (!visible) {
    return null;
  }

  const root = getOverlayRoot();
  if (!root) {
    return null;
  }

  // Apply synchronously, before the portal content renders, so the very first painted frame is
  // already themed (no unstyled flash). Idempotent — the root is a shared singleton.
  applyThemeVars(root, buildNativeWindThemeVars(theme));

  // tier zIndex orders overlays within the single #fp-overlay-root stacking context, so the
  // assistant ("top") sits above content overlays — same guarantee as native.
  return createPortal(
    <View
      pointerEvents={pointerEvents}
      style={{ ...FILL_STYLE, zIndex: tierZ(tier) }}
    >
      <OverlayLayerIdProvider value={layerId}>
        {children}
      </OverlayLayerIdProvider>
    </View>,
    root,
  );
}
