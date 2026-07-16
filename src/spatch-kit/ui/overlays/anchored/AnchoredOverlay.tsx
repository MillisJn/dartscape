import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { PopoverTransition } from "@spatch-kit/ui/animated/PopoverTransition";
import { OverlayPortal } from "../core/OverlayPortal";
import { useAnchorRect } from "./useAnchorRect";

type AnchoredOverlayProps = PropsWithChildren<{
  visible: boolean;
  anchorRef: RefObject<View | null>;
  onClose: () => void;
  /** Which edge of the panel aligns to the anchor. "end" = right-aligned (default), "start" = left. */
  align?: "start" | "end";
  /** Size the panel to the anchor's width (field dropdowns); otherwise the panel sizes to content. */
  matchAnchorWidth?: boolean;
  /** Vertical gap between the anchor and the panel. */
  gutter?: number;
  /** Keep the panel at least this far from the viewport edges. */
  screenPadding?: number;
  /**
   * How the overlay dismisses / relates to the page behind it:
   *  - "backdrop" (default): a full-screen backdrop catches outside taps AND the scroll wheel — the
   *    page can't scroll while it's open. Right for menus/popovers.
   *  - "page-scroll": WEB ONLY — non-modal, like a native desktop select. No blocking backdrop, so
   *    the page scrolls under the panel (wheel over the page). An outside pointer-down closes it, and
   *    scrolling the page closes it too — both DEFERRED to the next frame so the in-flight click /
   *    scroll completes first (a synchronous close here cancels react-native-web's press responder,
   *    which is what dead-locked clicks before). Falls back to "backdrop" on native.
   */
  dismissMode?: "backdrop" | "page-scroll";
}>;

const DEFAULT_GUTTER = 4;
const DEFAULT_SCREEN_PADDING = 12;
const MIN_PANEL_HEIGHT = 120;

// A menu/popover anchored to an on-screen element. It measures the anchor in window coordinates
// (see useAnchorRect) and renders the panel from the top-level OverlayPortal at those coordinates
// — so on web it escapes the ancestor transform/stacking-context trap while still appearing
// directly under (or beside) its trigger. A full-bleed backdrop dismisses on outside taps.
//
// Uses the SAME transition as the FAB menu (PopoverTransition) so anchored menus open with the same
// smooth fade+scale and no restart hitch. The panel is gated on being POSITIONED: PopoverTransition
// only becomes visible once the anchor is measured, so it fades in at its final spot instead of
// flashing at the top-left corner first.
export function AnchoredOverlay({
  visible,
  anchorRef,
  onClose,
  align = "end",
  matchAnchorWidth = false,
  gutter = DEFAULT_GUTTER,
  screenPadding = DEFAULT_SCREEN_PADDING,
  dismissMode = "backdrop",
  children,
}: AnchoredOverlayProps) {
  const theme = useTheme();
  // Non-modal "page-scroll" dismissal is a WEB-only affordance (native has no wheel-over-the-page and
  // wants a tap-to-dismiss backdrop). Everywhere else this collapses to the blocking backdrop.
  const pageScroll = dismissMode === "page-scroll" && Platform.OS === "web";
  // The panel node so the page-scroll listeners can tell an inside event (keep open / let the list
  // scroll) from an outside one (close).
  const panelRef = useRef<View | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Same lifecycle as FloatingActionMenu: `rendered` keeps the portal mounted through the exit fade
  // (guaranteed by a timer so it can never get stuck); `ready` gates the entrance until the portal
  // is on screen.
  const [rendered, setRendered] = useState(visible);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    const timer = setTimeout(
      () => setRendered(false),
      theme.motion.duration.normal + 40,
    );
    return () => clearTimeout(timer);
  }, [visible, theme.motion.duration.normal]);
  useEffect(() => {
    if (!rendered) {
      setReady(false);
    } else if (Platform.OS === "web") {
      setReady(true);
    }
  }, [rendered]);
  // NOTE: no useOverlayRegistration here — AnchoredOverlay's consumers (e.g. SearchScreen, field
  // dropdowns) register the menu's open state themselves. Registering again here would make the
  // single-active dismissal fight itself and slam the menu shut the instant it opens.

  // Page-scroll (web) dismissal: no backdrop catches outside input, so a document listener closes the
  // dropdown on an outside pointer-down. The close is DEFERRED one frame — closing synchronously
  // inside a capture-phase pointer listener re-renders mid-event and cancels RNW's press responder,
  // which dead-locks every click on the page. We never preventDefault, so the outside click still
  // lands on its target. Scrolling is intentionally NOT a dismiss trigger: the page scrolls freely
  // (no backdrop) and useAnchorRect re-measures on scroll, so the open panel follows its anchor.
  useEffect(() => {
    if (!pageScroll || !visible || typeof document === "undefined") {
      return;
    }
    let raf = 0;
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const panelNode = panelRef.current as unknown as HTMLElement | null;
      const anchorNode = anchorRef.current as unknown as HTMLElement | null;
      if (
        (panelNode?.contains(target) ?? false) ||
        (anchorNode?.contains(target) ?? false)
      ) {
        return;
      }
      if (raf) {
        return;
      }
      raf = requestAnimationFrame(() => {
        raf = 0;
        onCloseRef.current();
      });
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [pageScroll, visible, anchorRef]);

  // Measure the anchor as soon as we're mounted (and keep measuring through the exit fade so the
  // panel holds its position instead of snapping to the corner as it leaves).
  const rect = useAnchorRect(anchorRef, rendered);
  const window = useWindowDimensions();

  if (!rendered) {
    return null;
  }

  let panelStyle: ViewStyle | null = null;
  if (rect) {
    const top = rect.y + rect.height + gutter;
    panelStyle = {
      position: "absolute",
      top,
      maxHeight: Math.max(MIN_PANEL_HEIGHT, window.height - top - screenPadding),
    };

    if (matchAnchorWidth) {
      const width = rect.width;
      panelStyle.width = width;
      panelStyle.left = Math.min(
        Math.max(rect.x, screenPadding),
        Math.max(screenPadding, window.width - width - screenPadding),
      );
    } else if (align === "end") {
      panelStyle.right = Math.max(screenPadding, window.width - (rect.x + rect.width));
    } else {
      panelStyle.left = Math.max(screenPadding, rect.x);
    }
  }

  // Only claim the interactive overlay layer / render the click-catching backdrop once the panel is
  // POSITIONED. If the anchor can't be measured (rect stays null), an ungated backdrop would sit
  // full-screen eating every click with no visible panel to dismiss — and its registered layer would
  // keep `useHasActiveOverlay()` true (hiding the shell FAB). Gating on `positioned` makes an
  // unmeasurable anchor a harmless no-op instead of an app-wide click trap.
  const positioned = panelStyle != null;
  // Page-scroll mode never blocks: the document listeners above own dismissal. Otherwise the backdrop
  // catches outside taps + the scroll wheel — but only once positioned (see above).
  const showBackdrop = !pageScroll && positioned;

  return (
    <OverlayPortal
      active={visible && positioned}
      visible
      onRequestClose={onClose}
      onShow={() => setReady(true)}
    >
      {showBackdrop ? (
        <Pressable
          accessibilityLabel="Close menu"
          accessibilityRole="button"
          onPress={onClose}
          style={BACKDROP_STYLE}
        />
      ) : null}
      {/* Anchored menus have no shaded backdrop — just the panel fades/scales in/out. It stays hidden
          until it's been positioned (`panelStyle != null`), so it never flashes at the corner. */}
      <PopoverTransition
        visible={visible && ready && positioned}
        onExitComplete={() => setRendered(false)}
        pointerEvents="box-none"
        style={panelStyle ?? { position: "absolute", top: 0, left: 0 }}
      >
        {/* Page-scroll mode wraps the panel in a plain (layout-neutral) View so the document
            listeners have a real DOM node to test containment against. Backdrop menus render
            children directly, exactly as before. */}
        {pageScroll ? <View ref={panelRef}>{children}</View> : children}
      </PopoverTransition>
    </OverlayPortal>
  );
}

const BACKDROP_STYLE: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
