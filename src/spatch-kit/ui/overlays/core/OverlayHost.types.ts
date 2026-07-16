import { createContext, type ComponentType } from "react";

// Shared contract for the platform-split OverlayHost (.web / .native). Both implementations
// export `OverlayHost` with this type so consumers and the typecheck stay platform-agnostic.
//
// The native host is the always-mounted single overlay plane (a full-window box-none View
// wrapping one gorhom <PortalHost> + the lone hardware-back listener). The web host is a no-op
// (`null`) because web self-hosts its #fp-overlay-root singleton inside OverlayPortal.web.
export type OverlayHostComponent = ComponentType<Record<string, never>>;

// The single gorhom PortalHost name every native OverlayPortal teleports into.
export const OVERLAY_HOST_NAME = "fp-overlay";

// Set true by the wrapper that also mounts <PortalProvider> + <OverlayHost> (see _layout.tsx).
// OverlayPortal reads it to fail safe: with no host/provider ancestor it renders null (and
// console.errors in dev) instead of letting gorhom's usePortal throw. Default false.
export const OverlayHostReadyContext = createContext(false);
