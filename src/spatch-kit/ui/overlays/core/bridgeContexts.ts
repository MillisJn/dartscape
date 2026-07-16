import { createElement, type Context, type ReactNode } from "react";

// CONTEXT BRIDGE for the single in-tree overlay plane (native).
//
// On native, overlays are teleported (via @gorhom/portal) so they render at the PortalHost's
// position in the tree — which means React context provided BELOW the PortalProvider is NOT
// visible to teleported children (unlike RN <Modal> / web createPortal, which preserve tree
// context). This re-provides captured context values around the teleported children so they
// survive the teleport. No-op-equivalent on web (re-providing the same value is harmless), so
// callers use ONE code path.
//
// ── ARCHITECTURAL RULE (do not delete) ─────────────────────────────────────────────────────
// Any teleported overlay that consumes NAVIGATOR-SCOPED React context — anything provided
// below <PortalProvider>: Assistant, AssistantSettings, QuickCreate, QuickSearch, or future
// ones — MUST bridge that context here (read the value where the overlay is declared, above the
// portal, then pass it in). Root-level context (theme, nativewind vars, safe-area) and the
// module-level `db` singleton sit ABOVE the boundary / aren't context, so they need no bridge.
// Skipping this manifests as "context is undefined ONLY on native" — a silent runtime bug.
// ────────────────────────────────────────────────────────────────────────────────────────────

// A captured [Context, value] pair. Heterogeneous by nature (each pair has its own value type),
// so `Context<any>` is used to accept any context regardless of its value type.
export type ContextBridgeEntry = readonly [Context<any>, unknown];

/**
 * Wrap `children` in re-providers for each captured context so teleported content still
 * receives those values. Memoize the `entries` array at the call site (useMemo on the values)
 * so the providers aren't recreated every render and don't force needless subtree remounts.
 */
export function bridgeContexts(
  entries: ReadonlyArray<ContextBridgeEntry>,
  children: ReactNode,
): ReactNode {
  return entries.reduceRight<ReactNode>(
    (acc, [Ctx, value]) => createElement(Ctx.Provider, { value }, acc),
    children,
  );
}
