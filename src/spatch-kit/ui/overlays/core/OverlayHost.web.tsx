export type { OverlayHostComponent } from "./OverlayHost.types";

// Web self-hosts its single overlay plane: OverlayPortal.web portals into the #fp-overlay-root
// <body> singleton directly, so there is no separate host to mount here. Kept as a no-op so
// _layout.tsx stays platform-agnostic (it renders <OverlayHost/> on both platforms).
export function OverlayHost() {
  return null;
}
