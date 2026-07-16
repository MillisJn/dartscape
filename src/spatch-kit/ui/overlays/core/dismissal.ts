import { useEffect, useRef, useSyncExternalStore } from "react";

import { type OverlayTier, tierRank } from "./overlayTiers";

// This file hosts THREE intentionally-independent registries. They answer different
// questions and DO NOT synchronize with one another — a future "unify these into one
// overlay manager" refactor would be a deliberate decision, not an accident:
//   1. `activeOverlay`        — single-active dismissal: opening a picker/menu closes the
//                               previously-active one. (useOverlayRegistration)
//   2. `navigationDismissers` — route-scoped detail/editor popups that must close on ANY
//                               navigation. (registerNavigationDismissal)
//   3. `overlayLayers`        — every mounted OverlayPortal layer, for the single in-tree
//                               plane: z/back targeting, "is any overlay open", a11y owner.
//                               (useOverlayLayer + the selectors below)
// An overlay may participate in more than one; the registries never touch each other.

type OverlayCloseHandler = () => void;

type OverlayRegistration = {
  close: OverlayCloseHandler;
  id: string;
};

let activeOverlay: OverlayRegistration | null = null;
let overlaySequence = 0;

function clearActiveOverlay(id: string) {
  if (activeOverlay?.id === id) {
    activeOverlay = null;
  }
}

function registerOverlay(id: string, close: OverlayCloseHandler) {
  if (activeOverlay?.id === id) {
    activeOverlay = { close, id };
    return;
  }

  const previousOverlay = activeOverlay;
  activeOverlay = { close, id };

  if (previousOverlay) {
    previousOverlay.close();
  }
}

// Route-scoped overlays — detail/editor popups bound to the screen they were opened from. They opt
// OUT of the single-overlay `activeOverlay` stack (so a nested picker/menu opening inside them
// doesn't dismiss them), but they MUST close when the app navigates to another route — otherwise a
// popup left mounted on the now-backgrounded origin screen gets churned by the stack transition
// (visibly close → open → close). Tracked separately so `registerOverlay` (a picker opening) never
// touches them; only requestOverlayDismissal does, and that fires from the navigation runtime's
// onBeforeNavigation — i.e. the instant a route change is requested, before the router commits, so
// the popup unmounts in the same render as the push rather than mid-transition.
const navigationDismissers = new Set<OverlayCloseHandler>();

export function registerNavigationDismissal(
  close: OverlayCloseHandler,
): () => void {
  navigationDismissers.add(close);
  return () => {
    navigationDismissers.delete(close);
  };
}

export function useOverlayRegistration(
  visible: boolean,
  onClose: OverlayCloseHandler,
) {
  const idRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  if (!idRef.current) {
    overlaySequence += 1;
    idRef.current = `overlay-${overlaySequence}`;
  }

  onCloseRef.current = onClose;

  useEffect(() => {
    const overlayId = idRef.current!;

    if (!visible) {
      clearActiveOverlay(overlayId);
      return;
    }

    registerOverlay(overlayId, () => {
      onCloseRef.current();
    });

    return () => {
      clearActiveOverlay(overlayId);
    };
  }, [visible]);
}

export function requestOverlayDismissal() {
  let dismissed = false;

  // Route-scoped popups first: they close on ANY navigation (flush + clear so each fires once).
  if (navigationDismissers.size > 0) {
    const dismissers = [...navigationDismissers];
    navigationDismissers.clear();
    for (const close of dismissers) {
      close();
    }
    dismissed = true;
  }

  if (activeOverlay) {
    const overlayToClose = activeOverlay;
    activeOverlay = null;
    overlayToClose.close();
    dismissed = true;
  }

  return dismissed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry #3 — the single in-tree overlay plane's layer stack.
//
// Every mounted <OverlayPortal> registers a layer here (via useOverlayLayer). This is the
// source of truth for: which layer hardware-back dismisses, whether any overlay is open
// (drives the assistant's collapse-to-pill), and which single surface owns modal a11y.
//
// `interactive` is DECOUPLED from "mounted": a latch-using overlay (assistant/alert/toast)
// stays registered through its exit animation (`visible={open || mounted}`) but flips
// `interactive:false` the instant its intent (`active`) clears — so back targeting and
// "has overlay" never see a layer that's animating away. `seq` is a monotonic counter
// bumped on each activation edge (false→true), so a re-opened overlay is topmost in its
// tier every time. `seq` is intentionally unbounded for the process lifetime.
// ─────────────────────────────────────────────────────────────────────────────

export type OverlayLayer = {
  id: string;
  tier: OverlayTier;
  seq: number;
  interactive: boolean;
  backDismissable: boolean;
  onRequestClose?: OverlayCloseHandler;
};

const overlayLayers = new Map<string, OverlayLayer>();
let layerSeq = 0;
const layerListeners = new Set<() => void>();

function emitLayers() {
  for (const listener of layerListeners) {
    listener();
  }
}

export function subscribeOverlayLayers(listener: () => void): () => void {
  layerListeners.add(listener);
  return () => {
    layerListeners.delete(listener);
  };
}

type OverlayLayerInput = {
  id: string;
  tier: OverlayTier;
  active: boolean;
  backDismissable: boolean;
  onRequestClose?: OverlayCloseHandler;
};

// Idempotent upsert keyed by stable id (effect-phase only — never during render — so
// StrictMode double-invoke / concurrent re-renders converge to one entry). Bumps `seq`
// only on an activation edge so identity churn (a fresh onRequestClose each render) never
// reshuffles ordering.
export function upsertOverlayLayer(input: OverlayLayerInput): void {
  const existing = overlayLayers.get(input.id);
  const activationEdge = input.active && !(existing?.interactive ?? false);
  const seq = activationEdge ? ++layerSeq : (existing?.seq ?? ++layerSeq);

  overlayLayers.set(input.id, {
    id: input.id,
    tier: input.tier,
    seq,
    interactive: input.active,
    backDismissable: input.backDismissable,
    onRequestClose: input.onRequestClose,
  });
  emitLayers();
}

export function removeOverlayLayer(id: string): void {
  if (overlayLayers.delete(id)) {
    emitLayers();
  }
}

function maxBy<T>(
  items: Iterable<T>,
  rank: (item: T) => number,
): T | null {
  let best: T | null = null;
  let bestRank = -Infinity;
  for (const item of items) {
    const r = rank(item);
    if (r > bestRank) {
      bestRank = r;
      best = item;
    }
  }
  return best;
}

// The topmost interactive, back-dismissable layer — what hardware-back closes. A collapsed
// assistant pill registers `backDismissable:false`, so it's skipped and back falls through
// to the content overlay beneath it.
export function getTopOverlayLayer(): OverlayLayer | null {
  const candidates = [...overlayLayers.values()].filter(
    (layer) => layer.interactive && layer.backDismissable,
  );
  return maxBy(candidates, (l) => tierRank(l.tier) * 1e9 + l.seq);
}

// Dismiss the topmost back-dismissable overlay; returns true if it consumed the event.
export function dismissTopOverlay(): boolean {
  const layer = getTopOverlayLayer();
  if (layer?.onRequestClose) {
    layer.onRequestClose();
    return true;
  }
  return false;
}

// The topmost INTERACTIVE overlay layer — the one that "owns" the keyboard. Unlike getTopOverlayLayer
// it does NOT filter on back-dismissability (a focused input can live in a non-back-dismissable layer),
// only on interactivity. Null when nothing is open.
function getTopInteractiveOverlayLayer(): OverlayLayer | null {
  const candidates = [...overlayLayers.values()].filter(
    (layer) => layer.interactive,
  );
  return maxBy(candidates, (l) => tierRank(l.tier) * 1e9 + l.seq);
}

// Reactive: is the keyboard owned by an overlay ABOVE `myLayerId`? True when an interactive overlay is
// open and it is NOT this layer — i.e. this scroll view is a screen/overlay sitting BEHIND a higher
// overlay, so it must ignore the keyboard (which belongs to that higher overlay, e.g. a collection
// editor popped over the More sheet). `myLayerId` is null for the base app tree, where ANY open overlay
// owns the keyboard. When this layer IS the topmost (or nothing is open), returns false → react normally.
export function useKeyboardOwnedByHigherOverlay(
  myLayerId: string | null,
): boolean {
  return useSyncExternalStore(
    subscribeOverlayLayers,
    () => {
      const top = getTopInteractiveOverlayLayer();
      return top != null && top.id !== myLayerId;
    },
    () => false,
  );
}

export function hasActiveOverlay(opts?: { excludeTier?: OverlayTier }): boolean {
  for (const layer of overlayLayers.values()) {
    if (layer.interactive && layer.tier !== opts?.excludeTier) {
      return true;
    }
  }
  return false;
}

// Exactly ONE modal-a11y owner: the topmost interactive BLOCKING ("overlay" tier) layer.
// The "top" tier (the assistant) is never a blocking owner, so it can't steal modal a11y
// from a content overlay beneath it. Returns null when nothing blocking is open.
export function getA11yModalOwner(): OverlayLayer | null {
  const blocking = [...overlayLayers.values()].filter(
    (layer) => layer.interactive && layer.tier === "overlay",
  );
  return maxBy(blocking, (l) => l.seq);
}

// Test-only reset so the headless registry tests can isolate cases.
export function resetOverlayLayersForTest(): void {
  overlayLayers.clear();
  layerSeq = 0;
  layerListeners.clear();
}

// Test-only: number of registered layers (asserts idempotent upsert keeps one entry per id).
export function overlayLayerCountForTest(): number {
  return overlayLayers.size;
}

// Registers a layer for the lifetime the OverlayPortal renders content (`visible`), with
// `interactive` tracking the user's open intent (`active`, defaults to `visible`). Called
// by BOTH OverlayPortal.native and OverlayPortal.web so every overlay is a back/stack/a11y
// participant with zero per-consumer wiring. Returns the layer's stable id.
export function useOverlayLayer(
  visible: boolean,
  active: boolean,
  opts: {
    tier: OverlayTier;
    backDismissable: boolean;
    onRequestClose?: OverlayCloseHandler;
  },
): string {
  const idRef = useRef<string | null>(null);
  if (!idRef.current) {
    layerSeq += 1;
    idRef.current = `layer-${layerSeq}`;
  }
  const id = idRef.current;

  // Keep the close handler fresh without making it a dependency (it changes identity each
  // render); the effect re-runs only on meaningful changes, not on every render.
  const closeRef = useRef<OverlayCloseHandler | undefined>(opts.onRequestClose);
  closeRef.current = opts.onRequestClose;

  const { tier, backDismissable } = opts;
  useEffect(() => {
    if (!visible) {
      removeOverlayLayer(id);
      return;
    }
    upsertOverlayLayer({
      id,
      tier,
      active,
      backDismissable,
      onRequestClose: () => closeRef.current?.(),
    });
    return () => removeOverlayLayer(id);
  }, [id, visible, active, tier, backDismissable]);

  return id;
}

// Reactive "is any overlay (optionally excluding a tier) currently interactive?" — drives
// the assistant collapsing to a pill when a content overlay opens.
export function useHasActiveOverlay(opts?: {
  excludeTier?: OverlayTier;
}): boolean {
  const excludeTier = opts?.excludeTier;
  return useSyncExternalStore(
    subscribeOverlayLayers,
    () => hasActiveOverlay({ excludeTier }),
    () => hasActiveOverlay({ excludeTier }),
  );
}

// Reactive "is this layer the single modal-a11y owner?" — used by OverlayPortal.native to
// set iOS `accessibilityViewIsModal` on exactly one surface.
export function useIsA11yModalOwner(id: string): boolean {
  return useSyncExternalStore(
    subscribeOverlayLayers,
    () => getA11yModalOwner()?.id === id,
    () => false,
  );
}
