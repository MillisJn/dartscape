// Centralized overlay tier ordering — the SINGLE source of truth for how overlay layers
// stack on the one in-tree overlay plane (native: gorhom PortalHost; web: #fp-overlay-root).
//
// `tier` is a PURE ORDERING enum. It governs z-index only. Back semantics, a11y-owner
// selection, and the assistant's pill behavior are DERIVED from a layer's `interactive`
// state + tier inside dismissal.ts — they are NOT extra responsibilities bolted onto `tier`.
//
// Adding a new tier (e.g. "toast" / "system" / "tutorial") is a deliberate decision that
// requires choosing THREE things, not just appending here:
//   1. its z-index (tierZ below),
//   2. its hardware-back semantics (does it participate in dismissTopOverlay?),
//   3. its a11y ownership (can it be a modal owner? — see getA11yModalOwner in dismissal.ts).

export type OverlayTier = "overlay" | "top";

// Ordered low → high. Index is the rank; "top" outranks "overlay".
export const OVERLAY_TIERS = ["overlay", "top"] as const;

export const DEFAULT_OVERLAY_TIER: OverlayTier = "overlay";

export function tierRank(tier: OverlayTier): number {
  const rank = OVERLAY_TIERS.indexOf(tier);
  return rank === -1 ? 0 : rank;
}

// Base z-index applied to a layer's full-window wrapper. Peers within a tier still order by
// insertion (later-mounted paints on top); the explicit gap lifts "top" above every "overlay".
export function tierZ(tier: OverlayTier): number {
  return tier === "top" ? 1000 : 0;
}
