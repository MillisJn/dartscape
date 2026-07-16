import type { ReactNode } from "react";
import { PortalProvider } from "@gorhom/portal";

import { OverlayHostReadyContext } from "./OverlayHost.types";

// Wraps the app so every OverlayPortal consumer is under the single gorhom PortalProvider, and
// flips the ready flag so OverlayPortal teleports (rather than no-op'ing). Mounted ABOVE the
// startup gate in _layout — inside GestureHandlerRootView + SafeAreaProvider — so it never
// remounts across gate transitions. Keeping the gorhom import here (not in _layout) means
// @gorhom/portal stays a private detail of the overlays module (enforced by the arch guard).
export function OverlayPlaneProvider({ children }: { children: ReactNode }) {
  return (
    <PortalProvider>
      <OverlayHostReadyContext.Provider value={true}>
        {children}
      </OverlayHostReadyContext.Provider>
    </PortalProvider>
  );
}
