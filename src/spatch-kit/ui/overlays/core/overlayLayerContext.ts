import { createContext, useContext } from "react";

// The overlay LAYER ID of the nearest enclosing overlay surface — null in the base app tree. Provided
// by OverlayPortal around its teleported children, so every overlay's subtree knows which layer it
// lives in (even nested ones: a settings form inside the More sheet with a collection-editor popup on
// top). A keyboard-aware scroll reads this to decide whether the keyboard "belongs" to it: the keyboard
// is owned by the TOPMOST interactive overlay (or the base tree when none is open), so a scroll reacts
// only when its own layer is that top layer — see useKeyboardOwnedByHigherOverlay.
const OverlayLayerIdContext = createContext<string | null>(null);

export const OverlayLayerIdProvider = OverlayLayerIdContext.Provider;

export function useOverlayLayerId(): string | null {
  return useContext(OverlayLayerIdContext);
}
