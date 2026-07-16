import type { PropsWithChildren } from "react";

import type { OverlayTier } from "./overlayTiers";

// Shared contract for the platform-split OverlayPortal (.web / .native). Both implementations
// export `OverlayPortal` with this exact signature so consumers (and the typecheck) are
// platform-agnostic. See OverlayPortal.web.tsx / OverlayPortal.native.tsx.
//
// Both platforms now render onto a SINGLE in-tree overlay plane (native: one gorhom
// PortalHost; web: the #fp-overlay-root singleton), with stacking controlled by `tier` +
// insertion order — no per-overlay OS Modal. See OverlayPortal.native.tsx's header for the
// permanent invariants.
export type OverlayPortalProps = PropsWithChildren<{
  /** While true the overlay is mounted onto the single overlay plane (teleported on native). */
  visible: boolean;
  /**
   * Stacking tier on the shared plane. Defaults to "overlay". Only the assistant uses "top"
   * (so it stays above every content overlay and collapses to a pill instead of being buried).
   */
  tier?: OverlayTier;
  /**
   * The user's OPEN INTENT, decoupled from `visible`. Defaults to `visible`. Latch-using
   * overlays (assistant/alert/toast) pass `active={openIntent}` while keeping
   * `visible={open || mounted}`, so the layer stays mounted through its exit animation but is
   * treated as non-interactive (excluded from hardware-back targeting + "is any overlay open")
   * the instant it starts closing.
   */
  active?: boolean;
  /**
   * Whether hardware back (Android) should target this layer. Defaults to true. The assistant's
   * collapsed pill passes false so back closes the content overlay beneath it, not the pill.
   * Affects ONLY hardware-back target selection — programmatic dismissal is unaffected.
   */
  backDismissable?: boolean;
  /**
   * Pure-decoration overlays (e.g. a click-through toast) that should NOT participate in the
   * layer registry at all: not a hardware-back target, never collapse the assistant to a pill,
   * never own modal a11y. Defaults to false. (The overlay still renders on the plane.)
   */
  decorative?: boolean;
  /** Hardware back (Android) / Esc. Web overlays also dismiss via their own backdrop. */
  onRequestClose?: () => void;
  /** Fired once after the overlay is on screen (post-mount). Gates entrance animations. */
  onShow?: () => void;
  /** Legacy native Modal entrance animation. Now IGNORED on both platforms (content drives its own transition). */
  animationType?: "none" | "fade" | "slide";
  /**
   * Pointer behavior of the full-bleed fill wrapper:
   * - "box-none" (default): the wrapper is transparent to input but its children (a backdrop
   *   Pressable, the content) capture, so a bare toast leaves the page behind it clickable.
   * - "auto": the wrapper itself blocks all input behind the overlay — use for blocking loaders.
   */
  pointerEvents?: "box-none" | "auto";
}>;
