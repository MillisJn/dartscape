import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getLastKnownKeyboardHeight } from "@spatch-kit/hooks/keyboardHeightMemory";
import { useKeyboardHeight } from "@spatch-kit/hooks/useKeyboardHeight";
import { useTheme } from "@spatch-kit/theme/provider";
import { PopoverTransition } from "@spatch-kit/ui/animated/PopoverTransition";
import { SheetTransition } from "@spatch-kit/ui/animated/SheetTransition";
import { OverlayPortal } from "@spatch-kit/ui/overlays/core/OverlayPortal";
import { useOverlayRegistration } from "@spatch-kit/ui/overlays/core/dismissal";
import {
  SurfaceEnterProvider,
  type SurfaceEnterState,
} from "@spatch-kit/ui/overlays/core/surfaceEnterContext";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { IconButton } from "@spatch-kit/ui/primitives/IconButton";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AppModalProps = PropsWithChildren<{
  // Phone/native only: present as a bottom-ANCHORED sheet that hugs its content (capped, then
  // scrolls) and rises only as far as that content needs — a partial bottom sheet for SMALL forms
  // (e.g. a one-field note) or a select-style option list, instead of the full-screen sheet or the
  // floating centered card. Implies `slideUp` (a bottom sheet always slides up from the edge — the
  // implication is enforced in the body, so callers need NOT also pass `slideUp`); pair with
  // `liftWithKeyboard` when it hosts an input so it re-seats above the keyboard. On web ≥768 it falls
  // back to the centered capped panel (same as `centered`). Defaults to false.
  bottomSheet?: boolean;
  // When true, present as a centered card with margin that sizes to its content (capped at the
  // available height) and dismisses on backdrop tap — for small/medium forms — instead of the
  // edge-to-edge sheet. (On web ≥768 the default sheet already centers a capped panel.)
  centered?: boolean;
  // Max width of the compact centered card (phone / narrow web). Defaults to 520; a smaller value
  // (e.g. a short action list) keeps the dialog from stretching full-width.
  compactMaxWidth?: number;
  // When true (web tablet/desktop only, where the modal is a capped centered panel), show a
  // maximize/minimize toggle in the header that expands the panel to true full-bleed and back.
  // No-op on phone / native / the compact card. Defaults to false.
  expandable?: boolean;
  // Wide-web only: make the capped centered panel HUG its content (cap at ~90% height, scroll past
  // that) instead of stretching to the full viewport height. Opt-in for the FORM popups (creators,
  // editors, quick-adds) so a short form is a compact dialog, not a full-height panel with blank
  // space below the buttons. Leave OFF for surfaces whose child fills the height (image/crop/map
  // editors, search lists) — hugging would collapse a flex-1 child to nothing. No effect on
  // phone / native. Defaults to false.
  hugContent?: boolean;
  footer?: ReactNode;
  // Widens the capped panel (web tablet/desktop) beyond the form default. "wide" is for surfaces
  // that need the room — the area map editor and the document viewer, whose paper renders at 700px
  // and looks cramped/zoomed at the narrow form widths. No effect on the compact phone card.
  panelSize?: "default" | "wide";
  headerLeadingAccessory?: ReactNode;
  // Horizontal alignment of the header title. "left" (default) flushes the title to the leading
  // edge beside its icon — the app's standard popup chrome, shared by every titled modal so they
  // read as one system. "center" is the opt-out for the rare dialog that still wants a centred title.
  headerTitleAlign?: "center" | "left";
  // Rendered in the header to the LEFT of the close (X) button — e.g. a pencil that switches a
  // read-only detail popup into its editor.
  headerTrailingAccessory?: ReactNode;
  // Suppress the header close (X) button — used when the trailing accessory already owns the
  // top-right slot (e.g. the entity action menu) and dismissal is covered by the footer +
  // backdrop tap. Defaults to false.
  hideCloseButton?: boolean;
  // Suppress the entire header bar (title + close + accessories). Used to give a phone the full
  // screen for a map editor whose own chrome already covers naming + dismissal. The body then
  // reserves the top safe-area inset itself. Defaults to false.
  hideHeader?: boolean;
  // Opt-in for SMALL compact dialogs (a one-field creator like "New note", quick-add): re-center the
  // card ABOVE the keyboard when it opens, instead of the default behavior where the modal ignores
  // the keyboard and stays put (which is right for tall/full-screen forms — the user dismisses the
  // keyboard by dragging). Only the host knows a dialog is short enough to lift cleanly, so it opts
  // in. No-op on the wide web panel / full-bleed sheet. Defaults to false.
  liftWithKeyboard?: boolean;
  // Whether this modal joins the single-active dismissal stack (registry #1), where opening any
  // other overlay closes it and vice-versa. Defaults to FALSE so a nested overlay (a select / date /
  // entity picker hosted inside it) can open without auto-closing this modal — the common case, and
  // what makes in-modal pickers clickable. Set true ONLY for a lightweight menu-style popup that
  // genuinely wants to auto-dismiss when another picker opens. Either way the modal still dismisses
  // via its X button, backdrop tap, Android back, and navigation.
  manageOverlayDismissal?: boolean;
  onClose: () => void;
  // Optional: makes the header TITLE a tappable back/close target (in addition to any leading
  // accessory). Used by the navigational More sheet so the whole "‹ Icon Title" group — not just the
  // small chevron — pops a level, giving the back affordance a large hit area. Omit for the ordinary
  // dialogs whose title is inert.
  onTitlePress?: () => void;
  // Fired once the card is ON SCREEN (the portal has presented) — BEFORE the enter animation
  // completes. A creator uses this to start its auto-focus/keyboard AS the sheet slides in (instead of
  // after it), while still being safely past the mount commit (a `deferPastCommit` paint guard on the
  // consumer keeps it clear of the mid-mount Fabric focus-search crash — same timing the reduce-motion
  // path already uses safely).
  onOpen?: () => void;
  // Fired once the OPEN animation has fully settled — the sheet is on screen, painted, and its
  // slide/fade is done.
  onEntered?: () => void;
  // Fired once the close fade has fully finished. Request-driven popups that are conditionally
  // mounted by a parent use this to clear their payload AFTER the exit animation (so the modal
  // can fade out before it unmounts) instead of unmounting instantly on `onClose`.
  onClosed?: () => void;
  // Present as a bottom SHEET that slides up from the bottom edge on open (and back down on close),
  // instead of the default centered/full-screen cross-fade. Pair with `centered={false}` for the
  // full-screen creator sheets. Defaults to false.
  slideUp?: boolean;
  title: string;
  visible: boolean;
}>;

// On web, react-native-safe-area-context reports 0 insets, so full-screen overlay chrome would
// render under the notch / home indicator. Feed the browser's CSS env(safe-area-inset-*) straight
// into the header/footer padding instead — works because +html.tsx sets viewport-fit=cover.
// (Cast: RN's DimensionValue type rejects arbitrary CSS strings, but react-native-web passes them
// through to the DOM unchanged — same approach the codebase used for position:"fixed".)
const WEB_SAFE_AREA_TOP = {
  paddingTop: "env(safe-area-inset-top)",
} as unknown as ViewStyle;

export function AppModal({
  bottomSheet = false,
  centered = false,
  children,
  compactMaxWidth = 520,
  expandable = false,
  hugContent = false,
  footer,
  headerLeadingAccessory,
  headerTitleAlign = "left",
  headerTrailingAccessory,
  hideCloseButton = false,
  hideHeader = false,
  liftWithKeyboard = false,
  manageOverlayDismissal = false,
  onClose,
  onClosed,
  onEntered,
  onOpen,
  onTitlePress,
  panelSize = "default",
  slideUp = false,
  title,
  visible,
}: AppModalProps) {
  // Read insets HERE (in the app tree, under the root SafeAreaProvider) — they're reliable.
  // The body runs inside the portal's own SafeAreaProvider, which on Android can under-report the
  // bottom inset (initialWindowMetrics snapshot), which made the centered card sit low near the
  // nav bar. The body uses these for the compact-card math.
  const appInsets = useSafeAreaInsets();

  // Proven-smooth lifecycle (mirrors AppAlertHost / the delete alert): `rendered` keeps the card
  // mounted through the EXIT animation; `ready` gates the ENTRANCE until the portal is actually on
  // screen (native onShow / web effect) so the card + backdrop fade in instead of popping. The card's
  // transition (PopoverTransition / SheetTransition) owns the enter/exit animation on the native
  // driver — the exact mechanism the user validated as smooth.
  const [rendered, setRendered] = useState(visible);
  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!rendered) {
      setReady(false);
    } else if (Platform.OS === "web") {
      setReady(true);
    }
  }, [rendered]);
  const shown = visible && ready;

  // Fire onOpen ONCE the card is first on screen (shown) — before the enter animation completes — so a
  // consumer (the creator's auto-focus) can start the keyboard as the sheet slides in, not after.
  const hasOpenedRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  useEffect(() => {
    if (shown) {
      if (!hasOpenedRef.current) {
        hasOpenedRef.current = true;
        onOpenRef.current?.();
      }
    } else {
      hasOpenedRef.current = false;
    }
  }, [shown]);

  // `dismissEnabled` stays as state ONLY because useOverlayRegistration needs a reactive value to
  // register the overlay one frame after open. It is deliberately NOT passed to the memoized body —
  // a state flip mid-open must never re-render the ANIMATED card (that stalls the native driver;
  // see the smoothness fix). The backdrop's dismiss gate reads refs instead, so the card renders once.
  const [dismissEnabled, setDismissEnabled] = useState(false);
  const dismissEnabledRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const isFreshOpen = visible && !wasVisibleRef.current;
  const isFreshOpenRef = useRef(isFreshOpen);
  isFreshOpenRef.current = isFreshOpen;

  useOverlayRegistration(
    manageOverlayDismissal && visible && dismissEnabled && !isFreshOpen,
    onClose,
  );

  useEffect(() => {
    wasVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      dismissEnabledRef.current = false;
      setDismissEnabled(false);
      // Dismiss the keyboard the instant the modal starts CLOSING, so it slides down together with the
      // sheet instead of lingering ~300ms until the focused input finally unmounts after the exit.
      Keyboard.dismiss();
      return;
    }

    Keyboard.dismiss();

    let cancelled = false;
    const scheduleFrame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback: FrameRequestCallback) => setTimeout(callback, 0);
    const cancelFrame =
      typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : clearTimeout;

    const frameHandle = scheduleFrame(() => {
      if (!cancelled) {
        dismissEnabledRef.current = true;
        setDismissEnabled(true);
      }
    });

    return () => {
      cancelled = true;
      cancelFrame(frameHandle as never);
      dismissEnabledRef.current = false;
      setDismissEnabled(false);
    };
  }, [visible]);

  // Stable backdrop-dismiss handler read by the memoized body. Gated by refs (not props) so the
  // one-frame dismiss-enable flip never re-renders the card mid-animation. onClose is stable for the
  // duration of an open (the host doesn't re-render while the modal animates).
  const handleBackdropPress = useCallback(() => {
    if (dismissEnabledRef.current && !isFreshOpenRef.current) {
      onClose();
    }
  }, [onClose]);

  // Stable enter/exit handlers so the memoized body isn't re-rendered by a fresh closure. The card
  // transition drives them: onEnterComplete → onEntered (auto-focus after open); onExitComplete →
  // unmount (setRendered(false)) + onClosed.
  const handleEnterComplete = useCallback(() => {
    onEntered?.();
  }, [onEntered]);
  const handleExitComplete = useCallback(() => {
    setRendered(false);
    onClosed?.();
  }, [onClosed]);

  // Gate on `rendered` (not `visible`) so the close animation can finish before the tree unmounts.
  if (!rendered) {
    return null;
  }

  const body = (
    <AppModalBody
      appInsets={appInsets}
      bottomSheet={bottomSheet}
      centered={centered}
      compactMaxWidth={compactMaxWidth}
      expandable={expandable}
      hugContent={hugContent}
      footer={footer}
      headerLeadingAccessory={headerLeadingAccessory}
      headerTitleAlign={headerTitleAlign}
      headerTrailingAccessory={headerTrailingAccessory}
      hideCloseButton={hideCloseButton}
      hideHeader={hideHeader}
      liftWithKeyboard={liftWithKeyboard}
      onBackdropPress={handleBackdropPress}
      onClose={onClose}
      onEnterComplete={handleEnterComplete}
      onExitComplete={handleExitComplete}
      onTitlePress={onTitlePress}
      panelSize={panelSize}
      shown={shown}
      slideUp={slideUp}
      title={title}
    >
      {children}
    </AppModalBody>
  );

  // animationType="none" + onShow ready-gate (like AppAlertHost); the overlay drives its OWN
  // transition. NO nested SafeAreaProvider — the body reads the stable app-tree `appInsets` (root
  // safe-area context survives the portal teleport), so nothing re-measures/re-renders mid-animation.
  // OverlayPortal tags this subtree with its overlay layer id (see overlayLayerContext), so a
  // keyboard-aware scroll hosted in the modal knows whether the keyboard belongs to it (topmost) or to
  // a higher overlay stacked above it, while screens BEHIND the modal ignore it.
  return (
    <OverlayPortal
      active={visible}
      animationType="none"
      onRequestClose={onClose}
      onShow={() => setReady(true)}
      visible
    >
      {body}
    </OverlayPortal>
  );
}

type AppModalBodyProps = PropsWithChildren<{
  // Reliable insets read in the app tree by AppModal (under the root provider — stable, measured
  // once). Passed in so the body reads NO safe-area hook of its own (that would re-render mid-open).
  appInsets: { top: number; bottom: number; left: number; right: number };
  // True once the overlay has actually presented (host onShow) — drives the card + backdrop entrance.
  shown: boolean;
  bottomSheet: boolean;
  centered: boolean;
  compactMaxWidth?: number;
  expandable?: boolean;
  hugContent?: boolean;
  footer?: ReactNode;
  panelSize?: "default" | "wide";
  headerLeadingAccessory?: ReactNode;
  headerTitleAlign?: "center" | "left";
  headerTrailingAccessory?: ReactNode;
  hideCloseButton?: boolean;
  hideHeader?: boolean;
  liftWithKeyboard?: boolean;
  // Stable, ref-gated backdrop-dismiss handler (never changes mid-open) — see AppModal.
  onBackdropPress: () => void;
  // Fired by the card transition once the ENTER settles (→ onEntered) / after the EXIT (→ unmount).
  onEnterComplete: () => void;
  onExitComplete: () => void;
  onTitlePress?: () => void;
  slideUp?: boolean;
  onClose: () => void;
  title: string;
}>;

// The modal card + backdrop. `memo` is LOAD-BEARING for smoothness: AppModal re-renders once per
// open (the dismiss-enable state flip), and without memo that would re-render this animated card
// mid-animation and stall the native driver. All props here are stable for the duration of an open,
// so memo skips that re-render and the card renders exactly once — the animation runs untouched.
const AppModalBody = memo(function AppModalBody({
  appInsets,
  shown,
  bottomSheet,
  centered,
  children,
  compactMaxWidth = 520,
  expandable = false,
  hugContent = false,
  footer,
  headerLeadingAccessory,
  headerTitleAlign = "left",
  headerTrailingAccessory,
  hideCloseButton = false,
  hideHeader = false,
  liftWithKeyboard = false,
  onBackdropPress,
  onEnterComplete,
  onExitComplete,
  onTitlePress,
  slideUp = false,
  onClose,
  panelSize = "default",
  title,
}: AppModalBodyProps) {
  const theme = useTheme();
  // Insets come from the passed appInsets (app-tree, stable) — the body deliberately does NOT call
  // useSafeAreaInsets itself, which would re-render it after mount (mid-animation) on Android.
  const insets = appInsets;
  // Publish "the card has finished animating in" to the subtree, so anything that measures geometry
  // (the keyboard-aware scrolls) waits for the sheet to settle instead of measuring it mid-slide —
  // see surfaceEnterContext for what a mid-slide measurement actually reports. Ref-backed with a
  // stable value, so the flip re-renders NOTHING (a re-render here would stall the native driver).
  // The body remounts per open (AppModal unmounts on !rendered), so this resets each time.
  const enteredRef = useRef(false);
  const enterWaitersRef = useRef(new Set<() => void>());
  const surfaceEnter = useMemo<SurfaceEnterState>(
    () => ({
      whenEntered: (callback) => {
        if (enteredRef.current) {
          callback();
          return () => {};
        }
        enterWaitersRef.current.add(callback);
        return () => {
          enterWaitersRef.current.delete(callback);
        };
      },
    }),
    [],
  );
  const handleCardEnterComplete = useCallback(() => {
    enteredRef.current = true;
    const waiters = [...enterWaitersRef.current];
    enterWaitersRef.current.clear();
    for (const waiter of waiters) {
      waiter();
    }
    onEnterComplete();
  }, [onEnterComplete]);
  // Tablet/desktop web only: toggle the capped centered panel to a true full-bleed sheet. Resets
  // each open since the modal unmounts on !visible.
  const [expanded, setExpanded] = useState(false);
  // Only the small `liftWithKeyboard` dialogs actually track the keyboard; every other modal freezes
  // its height and ignores it. Subscribing only when needed means a keyboard show/hide/dismiss never
  // re-renders the animating card on the common (non-lift) modals — keeping the open animation smooth.
  const { height: keyboardHeight, screenY: keyboardScreenY } =
    useKeyboardHeight(liftWithKeyboard);
  // Track whether the keyboard has appeared at least once during THIS open (resets on unmount, since
  // the body remounts per open). It gates the "reserve last-known height" behavior below: we reserve
  // space BEFORE the keyboard first shows (so the sheet opens already lifted in one motion), but once
  // the keyboard has shown and is then dismissed (e.g. the user taps off the field), we must NOT keep
  // reserving — otherwise the sheet stays stuck up at the keyboard's old height instead of dropping
  // back to the bottom. After the first show, the live keyboard height alone drives the lift (0 when
  // down → sheet returns to the bottom edge).
  const [keyboardHasShown, setKeyboardHasShown] = useState(false);
  useEffect(() => {
    if (keyboardHeight > 0 && !keyboardHasShown) {
      setKeyboardHasShown(true);
    }
  }, [keyboardHeight, keyboardHasShown]);
  const { height: liveWindowHeight, width: windowWidth } =
    useWindowDimensions();
  // Freeze the window height captured while the keyboard is DOWN. Overlays teleport into the app's
  // single in-tree overlay host, so the activity's `adjustResize` shrinks the whole root (and this
  // modal with it) when the keyboard opens. Measuring everything against this frozen height — never
  // the live (shrunk) one — makes the modal IGNORE the keyboard: it neither shrinks nor lifts. The
  // keyboard just overlays the bottom, and the user dismisses it by dragging the form
  // (keyboardDismissMode="on-drag"). Writing the ref in render is safe: it only ever records the
  // last keyboard-down height (idempotent per commit).
  const stableWindowHeightRef = useRef(liveWindowHeight);
  if (keyboardHeight === 0) {
    stableWindowHeightRef.current = liveWindowHeight;
  }
  const windowHeight = stableWindowHeightRef.current;
  // On a wide browser, a literal full-screen sheet stretches awkwardly — present a
  // centered, capped panel with rounded corners instead. Native is untouched.
  const isWidePanel = Platform.OS === "web" && windowWidth >= 768;
  // Bottom sheet (phone/native): a content-hugging panel pinned to the bottom edge that rises only
  // as far as its content needs — for small forms. On wide web it falls back to the capped panel.
  const isBottomSheet = bottomSheet && !isWidePanel;
  // Centered/compact: a card that sizes to its content (capped at the available height) and
  // floats with margin, dismissed by tapping the backdrop. Used for small/medium forms. The bottom
  // sheet takes precedence over `centered` on phones (both may be passed so `centered` still governs
  // the wide-web panel width).
  const isCompact = centered && !isWidePanel && !isBottomSheet;
  // Both the compact card and the bottom sheet HUG their content (no flex-1 fill): they size to the
  // form and scroll only once capped, rather than stretching to the full height.
  const contentHugs = isCompact || isBottomSheet;
  // Every surface — slide-up sheets included — shows the shaded backdrop scrim, which fades in on
  // open and out on close via `backdropOpacity`. (This used to be suppressed for phone slide-up
  // sheets, but the product wants the dimmed background to fade in behind a rising note/creator/
  // detail sheet, matching the centered dialogs.)
  // The expand toggle only exists on the capped wide panel; when toggled, the panel drops its
  // max width / rounding / surrounding padding to fill the viewport.
  const showExpandToggle = expandable && isWidePanel;
  const wideFullBleed = isWidePanel && expanded;
  // A capped wide-web panel HUGS its content (caps at ~90% height, scrolls past that) only when the
  // host opts in (`hugContent`, for the FORM popups) and it isn't expanded to full-bleed. Hugging is
  // what stops a short form (e.g. Add Note) from rendering a full-height dialog with blank space
  // below the buttons. Everything else keeps the full-height panel (filling child editors / lists).
  const wideHugs = isWidePanel && !wideFullBleed && hugContent;
  // Any surface that sizes to its content rather than stretching: the phone compact card / bottom
  // sheet AND the hugging wide-web panel. Drives the Surface's flex (no flex-1 fill) and the inner
  // content wrapper's flexShrink.
  const surfaceHugs = contentHugs || wideHugs;
  // Slide-up motion is a phone affordance: a sheet rising from the bottom edge. On a wide screen
  // there is no bottom edge to rise from — the popup is a centered dialog — so it cross-fades in
  // place instead. `useSlide` therefore gates BOTH the translateY transform and the opacity mode
  // below, so desktop/web ≥768 fades regardless of the `slideUp`/`bottomSheet` props.
  // A `bottomSheet` ALWAYS slides (it's a partial sheet pinned to the bottom edge) — that's what the
  // prop means — so it implies slide without the caller having to also pass `slideUp`; the two used to
  // be independent, which let some bottom sheets (e.g. the report Details popup) render bottom-anchored
  // but cross-fade in place instead of sliding. Folding the implication in here unifies every partial
  // sheet onto the same slide-up motion.
  const useSlide = (slideUp && !isWidePanel) || isBottomSheet;
  // Compact card placement (done manually against the frozen height above). The card is centered
  // within the app SAFE space (between the status bar and the nav bar) and STAYS there when the
  // keyboard opens — no keyboard-driven lift or shrink.
  const VERTICAL_MARGIN = 24;
  // Tighter side margin on phones (the user wanted less left/right gutter).
  const compactSideMargin = 12;
  // Use the app-tree insets (reliable) for the compact card; the body's own provider can report a
  // 0 bottom inset on Android, which dropped the card down by the nav bar.
  const usableBottom = windowHeight - appInsets.bottom - VERTICAL_MARGIN;
  const compactPaddingTop = appInsets.top;
  const compactPaddingBottom = windowHeight - usableBottom;
  // Cap to ~90% of the safe-area height so it reads as a centered dialog (margin top AND bottom),
  // not a near-full-screen sheet, even for taller forms (which then scroll inside).
  const safeAreaHeight = windowHeight;
  const compactMaxHeight = Math.max(
    Math.min(
      usableBottom - compactPaddingTop,
      Math.round(safeAreaHeight * 0.9),
    ),
    180,
  );
  // Small opt-in dialogs (liftWithKeyboard) re-center ABOVE the keyboard: shrink the centering
  // region from the bottom by the LIVE keyboard height (+ gap) so the short card lifts into the
  // space above it, and cap its height to that region so it can't overflow past the safe top. Every
  // other modal keeps the frozen bottom padding and simply ignores the keyboard.
  // The lifted sheet's bottom edge sits FLUSH against the top of the keyboard (no variable gap) — the
  // sticky footer's own padding is the single, fixed spacing between the Cancel/Save row and the
  // keyboard, so every lifted sheet reads identically.
  const KEYBOARD_LIFT_GAP = 0;

  // Reserve the keyboard's space the moment a lift-enabled sheet opens — BEFORE the keyboard has
  // shown — using the last REAL height we observed and persisted (see keyboardHeightMemory). This is
  // what lets the sheet open already seated above the keyboard in ONE motion, instead of settling at
  // the bottom then jumping up when the keyboard finally appears. Once the keyboard actually shows,
  // `keyboardHeight` is live and takes over — and since the reserved value IS the last real height,
  // they match, so there's no visible re-seat. On a fresh install's first-ever keyboard use the
  // persisted value is 0, so we fall back to the honest live lift (no estimate) and learn it for next
  // time. Only lift-opted, content-hugging dialogs (New Note, quick-adds) reserve — those auto-focus,
  // so the keyboard is genuinely coming; every other modal ignores the keyboard as before.
  // The keyboard's occlusion of the FROZEN window, measured from `screenY` (the absolute Y of the
  // keyboard's top edge). This is robust to `adjustResize` shrinking the host, unlike
  // `endCoordinates.height`, which under-reports on edge-to-edge Android (it excludes the nav-bar
  // inset) and left the sheet sitting slightly UNDER the keyboard. 0 when the keyboard is down.
  const liveKeyboardGap =
    keyboardScreenY > 0 ? Math.max(0, windowHeight - keyboardScreenY) : 0;
  const reservedKeyboardHeight =
    liveKeyboardGap > 0
      ? liveKeyboardGap
      : liftWithKeyboard && contentHugs && !keyboardHasShown
        ? getLastKnownKeyboardHeight()
        : 0;
  const liftsForKeyboard =
    liftWithKeyboard && contentHugs && reservedKeyboardHeight > 0;
  const compactPaddingBottomResolved = liftsForKeyboard
    ? reservedKeyboardHeight + KEYBOARD_LIFT_GAP
    : compactPaddingBottom;
  const compactMaxHeightResolved = liftsForKeyboard
    ? Math.max(
        windowHeight - compactPaddingTop - compactPaddingBottomResolved,
        180,
      )
    : compactMaxHeight;
  // A defined border + a strong drop shadow on the FLOATING cards (the compact phone card and the
  // web capped panel) so they read as clearly-lifted popups — matching the host popups (dropdowns /
  // action menus, which use FormSurface's border + theme.shadow.card). The edge-to-edge sheet and
  // the full-bleed panel skip it (nothing to lift off).
  const floatingCardChrome: ViewStyle = {
    // boxShadow (NOT elevation): fades with the card's opacity and won't flicker a map underneath —
    // see theme.shadow.overlay / PopoverTransition invariants.
    boxShadow: theme.shadow.overlay.boxShadow,
    borderColor: theme.colors.border,
    borderWidth: theme.borderWidth.sm,
  };

  // SIZING (width + fill height) lives on the animated wrapper so the scale/slide composites only the
  // CARD region, not the full screen — the key to native smoothness. Height CAPS (maxHeight, so the
  // card scrolls internally) stay on Surface below, which the wrapper then hugs. Surface fills the
  // wrapper's width (width:100% + flex-1 for the full-height cases).
  const cardSizeStyle: ViewStyle = isBottomSheet
    ? { width: "100%" }
    : isCompact
      ? { maxWidth: compactMaxWidth, width: "100%" }
      : isWidePanel
        ? {
            width: "100%",
            ...(wideHugs ? null : { height: "100%" }),
            ...(wideFullBleed
              ? null
              : {
                  maxWidth: panelSize === "wide" ? 1024 : centered ? 560 : 720,
                }),
          }
        : { height: "100%", width: "100%" };

  const cardChromeStyle: ViewStyle = isBottomSheet
    ? {
        // Edge-to-edge, pinned to the bottom: only the TOP corners round, and only a top border +
        // upward shadow lift it off the screen behind. Hugs its content, scrolling once it hits the cap.
        boxShadow: theme.shadow.overlay.boxShadow,
        borderTopColor: theme.colors.border,
        borderTopWidth: theme.borderWidth.sm,
        borderTopLeftRadius: theme.radius.lg,
        borderTopRightRadius: theme.radius.lg,
        maxHeight: compactMaxHeightResolved,
        overflow: "hidden",
        width: "100%",
      }
    : isCompact
      ? {
          ...floatingCardChrome,
          borderRadius: theme.radius.lg,
          maxHeight: compactMaxHeightResolved,
          overflow: "hidden",
          width: "100%",
        }
      : isWidePanel
        ? {
            borderRadius: wideFullBleed ? 0 : theme.radius.lg,
            // The capped (non-full-bleed) panel gets the border + shadow chrome so it lifts off.
            ...(wideFullBleed ? null : floatingCardChrome),
            // Hugging panels cap at ~90% height (scroll past that); fill-height panels take the whole
            // height via flex-1 filling the wrapper's height:100%.
            ...(wideHugs ? { maxHeight: compactMaxHeightResolved } : null),
            overflow: "hidden",
            width: "100%",
          }
        : { borderRadius: 0, width: "100%" };

  const CardTransition = useSlide ? SheetTransition : PopoverTransition;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Shaded backdrop that fades in/out on its OWN ready gate (identical to the delete alert),
          isolated in its own component so its backdropReady state can never re-render the animating
          card. The Pressable captures the dismiss tap. */}
      <ModalBackdrop onPress={onBackdropPress} shown={shown} />

      {/* Full-screen POSITIONING layer (plain View, NOT animated): centers/anchors the card. Pinned
          to the FROZEN window height (top-anchored) rather than StyleSheet.absoluteFill, which would
          track the live window that `adjustResize` shrinks when the keyboard opens — collapsing this
          layer and lifting the centered card. The part that falls under the keyboard is simply clipped
          by the (shrunk) overlay host, which is fine — it's behind the keyboard. */}
      <View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: windowHeight,
          },
          isBottomSheet
            ? {
                // Anchor the content-hugging sheet to the bottom edge; the slide transform carries it
                // up from below. When the keyboard opens (and the host opted in via liftWithKeyboard),
                // grow the bottom padding by the keyboard height so the sheet re-seats above it.
                justifyContent: "flex-end",
                paddingBottom: liftsForKeyboard
                  ? reservedKeyboardHeight + KEYBOARD_LIFT_GAP
                  : 0,
              }
            : isCompact
              ? {
                  alignItems: "center",
                  justifyContent: "center",
                  paddingLeft: compactSideMargin,
                  paddingRight: compactSideMargin,
                  // Centers within the app safe space. Stays put when the keyboard opens, UNLESS the
                  // host opted into liftWithKeyboard (small dialogs), where the bottom padding grows
                  // by the keyboard height so the card re-centers above it.
                  paddingTop: compactPaddingTop,
                  paddingBottom: compactPaddingBottomResolved,
                }
              : isWidePanel
                ? {
                    alignItems: "center",
                    justifyContent: "center",
                    padding: wideFullBleed ? 0 : 24,
                  }
                : null,
        ]}
        // Let taps on the empty area around the floating panel fall through to the backdrop
        // (dismiss); the panel itself still captures its own touches. This applies to the
        // compact phone card AND the web tablet/desktop capped panel — without it, that
        // full-screen layer swallows clicks in the padding around the panel and the backdrop
        // tap never reaches `onClose`. (Full-bleed sheets have no padding, so box-none is a
        // harmless no-op there.)
        pointerEvents={
          isCompact || isBottomSheet || isWidePanel ? "box-none" : undefined
        }
      >
        {/* The CARD is a single PopoverTransition (centered → grow+fade) or SheetTransition (slide →
            slide+fade) node — the exact proven-smooth mechanism (opacity + scale/translateY on the
            native driver, ENTER in a separate committed-frame effect). Sizing + chrome ride on its
            style so it's card-sized (composites just the card, not the screen). It owns the whole
            animation; nothing else animates the content. */}
        <CardTransition
          className={
            surfaceHugs ? "bg-surface-raised" : "flex-1 bg-surface-raised"
          }
          onEnterComplete={handleCardEnterComplete}
          onExitComplete={onExitComplete}
          style={[cardSizeStyle, cardChromeStyle]}
          visible={shown}
        >
          {hideHeader ? null : (
            <View
              className="border-b border-border bg-surface-raised"
              style={
                // A content-hugging card/sheet (centered card or bottom sheet) doesn't reach the
                // top of the screen, so it shouldn't reserve the safe-area top inset — only the
                // edge-to-edge full-screen sheet does.
                contentHugs
                  ? undefined
                  : Platform.OS === "web"
                    ? WEB_SAFE_AREA_TOP
                    : { paddingTop: insets.top }
              }
            >
              <View className="flex-row items-center justify-between gap-app-md px-app-md pt-app-md pb-app-xxs">
                {/* Left-aligned: the leading accessory (entity icon) and title sit together as one
                  tight group so the title hugs the icon. Centered: the accessory goes in a fixed
                  spacer that balances the trailing close button, keeping the title optically centred.
                  When `onTitlePress` is set the title becomes a tappable back/close target (a large hit
                  area for the small chevron beside it) — used by the navigational More sheet. */}
                {headerTitleAlign === "left" ? (
                  <View className="flex-1 flex-row items-center gap-app-sm">
                    {headerLeadingAccessory}

                    {onTitlePress ? (
                      <Pressable
                        accessibilityRole="button"
                        className="flex-1 active:opacity-60"
                        hitSlop={8}
                        onPress={onTitlePress}
                      >
                        <AppText
                          className="text-left"
                          numberOfLines={1}
                          variant="sectionTitle"
                        >
                          {title}
                        </AppText>
                      </Pressable>
                    ) : (
                      <AppText
                        className="flex-1 text-left"
                        numberOfLines={1}
                        variant="sectionTitle"
                      >
                        {title}
                      </AppText>
                    )}
                  </View>
                ) : (
                  <>
                    <View className="min-w-[44px] items-start justify-center">
                      {headerLeadingAccessory}
                    </View>
                    {onTitlePress ? (
                      <Pressable
                        accessibilityRole="button"
                        className="flex-1 active:opacity-60"
                        hitSlop={8}
                        onPress={onTitlePress}
                      >
                        <AppText
                          className="text-center"
                          numberOfLines={1}
                          variant="sectionTitle"
                        >
                          {title}
                        </AppText>
                      </Pressable>
                    ) : (
                      <AppText
                        className="flex-1 text-center"
                        numberOfLines={1}
                        variant="sectionTitle"
                      >
                        {title}
                      </AppText>
                    )}
                  </>
                )}
                <View className="flex-row items-center gap-app-sm">
                  {showExpandToggle ? (
                    <Pressable
                      accessibilityLabel={
                        expanded ? "Restore window" : "Expand to full screen"
                      }
                      accessibilityRole="button"
                      className="items-center justify-center active:opacity-50"
                      onPress={() => setExpanded((current) => !current)}
                      style={{ cursor: "pointer" } as unknown as ViewStyle}
                    >
                      <AppIcon
                        color={theme.colors.mutedText}
                        name={expanded ? "minimize" : "maximize"}
                        size={22}
                      />
                    </Pressable>
                  ) : null}
                  {headerTrailingAccessory}
                  {hideCloseButton ? null : (
                    // Bare IconButton (no border) so it lines up with the kebab + quick-action icons
                    // of the header action menu to its left, with the standard hover/press affordance.
                    // Negative right margin eases its 44px target back toward the header edge.
                    <IconButton
                      color={theme.colors.mutedText}
                      icon="close"
                      label="Close modal"
                      onPress={onClose}
                      size={28}
                    />
                  )}
                </View>
              </View>
            </View>
          )}

          <View
            className="overflow-hidden"
            style={[
              surfaceHugs ? { flexShrink: 1 } : { flex: 1 },
              // No header bar → the body reserves the top safe-area inset itself so content
              // (e.g. a map editor's floating chrome) clears the notch.
              hideHeader
                ? Platform.OS === "web"
                  ? WEB_SAFE_AREA_TOP
                  : { paddingTop: insets.top }
                : null,
              // Full-screen sheet WITHOUT a sticky footer (e.g. the creator route, whose Cancel/Save
              // scroll at the bottom of the form body): reserve the bottom safe-area inset here so
              // that trailing content clears the Android system nav bar / iOS home indicator. Uses
              // the reliable APP-tree inset (the body's own provider under-reports it). A sheet WITH
              // a `footer` lets the footer own that inset instead; the compact card floats free. A
              // chrome-owning full-bleed editor (hideHeader — the area map) is also skipped: its
              // floating chrome already reserves the bottom inset via its own SafeAreaView, so
              // adding it here too double-insets and lifts the toolbar off the bottom edge.
              !isCompact && !footer && !hideHeader
                ? liftsForKeyboard
                  ? // Lifted ABOVE the keyboard: the nav bar / home indicator is behind the keyboard,
                    // so reserving its inset here just pushes the trailing Cancel/Save further from the
                    // keyboard. Use a small gap instead so they sit close to it.
                    { paddingBottom: theme.space.sm }
                  : Platform.OS === "web"
                    ? ({
                        paddingBottom: "env(safe-area-inset-bottom)",
                      } as unknown as ViewStyle)
                    : { paddingBottom: appInsets.bottom }
                : null,
            ]}
          >
            {/* Content is always mounted here (even while the sheet still sits off-screen below):
                useOverlayPresence arms the slide one frame past the mount commit, so the sheet
                slides up with its views already committed rather than chrome-first. Which is exactly
                why the subtree needs SurfaceEnterProvider: a form in here is mounted and focusable
                while the sheet it rides on is still off-screen, so anything measuring its own
                position must wait for the slide to settle first. */}
            <SurfaceEnterProvider value={surfaceEnter}>
              {children}
            </SurfaceEnterProvider>
          </View>

          {footer ? (
            <View
              className="border-t border-border bg-surface-raised"
              style={[
                // The compact card is already inset by its centering margins, so its sticky
                // footer just needs standard padding — not another safe-area bottom inset. Same when
                // the sheet is lifted above the keyboard: the nav-bar inset is behind the keyboard, so
                // dropping it keeps Cancel/Save close to the keyboard instead of floating above it.
                isCompact || liftsForKeyboard
                  ? { paddingBottom: theme.space.sm }
                  : Platform.OS === "web"
                    ? ({
                        paddingBottom: `max(env(safe-area-inset-bottom), ${theme.space.sm}px)`,
                      } as unknown as ViewStyle)
                    : {
                        // Use the APP-tree inset (reliable): the body's own SafeAreaProvider can
                        // under-report the bottom inset on Android, which let the footer's Cancel/Save
                        // collide with the system navigation bar. Add a base gap ON TOP of the inset so
                        // the actions always clear the nav / gesture pill with breathing room, instead
                        // of sitting flush on a small (gesture-nav) inset.
                        paddingBottom: appInsets.bottom + theme.space.sm,
                      },
              ]}
            >
              <View className="px-app-md pt-app-sm">{footer}</View>
            </View>
          ) : null}
        </CardTransition>
      </View>
    </View>
  );
});

// The dim backdrop — its own component so the `backdropReady` state that gates the fade can never
// re-render the animating card. Fades in fast on the ready gate / out over normal, exactly as the
// delete alert (AppAlertHost), so the scrim fades in step with the card instead of snapping in.
function ModalBackdrop({
  shown,
  onPress,
}: {
  shown: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [backdropReady, setBackdropReady] = useState(false);
  useEffect(() => {
    if (shown) setBackdropReady(true);
  }, [shown]);
  useEffect(() => {
    if (!theme.motion.enabled) {
      backdropOpacity.setValue(shown ? 1 : 0);
      return;
    }
    // Never animate before the view has committed on screen (else it snaps).
    if (shown && !backdropReady) {
      return;
    }
    const anim = Animated.timing(backdropOpacity, {
      toValue: shown ? 1 : 0,
      duration: shown
        ? theme.motion.duration.fast
        : theme.motion.duration.normal,
      easing: shown ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    });
    anim.start();
    return () => anim.stop();
  }, [
    shown,
    backdropReady,
    backdropOpacity,
    theme.motion.enabled,
    theme.motion.duration.fast,
    theme.motion.duration.normal,
  ]);

  return (
    <AnimatedPressable
      accessibilityLabel="Dismiss modal"
      accessibilityRole="button"
      onPress={onPress}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.colors.surfaceOverlay,
          opacity: backdropOpacity,
        },
      ]}
    />
  );
}
