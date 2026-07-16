import type { ReactNode } from "react";

import { OverlayHostReadyContext } from "./OverlayHost.types";

// Web self-hosts its #fp-overlay-root singleton inside OverlayPortal.web, so there is no
// PortalProvider to mount. The ready flag still flips true to keep the native/web contract
// identical (OverlayPortal renders rather than no-op'ing).
export function OverlayPlaneProvider({ children }: { children: ReactNode }) {
  return (
    <OverlayHostReadyContext.Provider value={true}>
      {children}
    </OverlayHostReadyContext.Provider>
  );
}
