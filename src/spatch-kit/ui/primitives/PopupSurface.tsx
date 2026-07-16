import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "@spatch-kit/hooks/useKeyboardHeight";
import { useTheme } from "@spatch-kit/theme/provider";
import { PopoverTransition } from "@spatch-kit/ui/animated/PopoverTransition";
import { OverlayPortal } from "@spatch-kit/ui/overlays/core/OverlayPortal";
import { useOverlayRegistration } from "@spatch-kit/ui/overlays/core/dismissal";
import { FormSurface } from "@spatch-kit/ui/primitives/FormSurface";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PopupSurfacePadding = "none" | "sm" | "md" | "lg";

type PopupSurfaceProps = PropsWithChildren<{
  anchorRef: RefObject<View | null>;
  maxHeight?: number;
  maxWidth?: number;
  minHeight?: number;
  minWidth?: number;
  onClose: () => void;
  padding?: PopupSurfacePadding;
  presentation?: "anchored" | "centered";
  visible: boolean;
}>;

const WINDOW_PADDING = 16;

// Centered popup surface for dropdowns / selects / date-time-color pickers. Uses the validated
// smooth mechanism (OverlayPortal + rendered/ready/onShow lifecycle + a backdropReady-gated backdrop
// + a single PopoverTransition card) — the same setup as the delete alert / Quick Create, so it opens
// and closes buttery on the native driver.
export function PopupSurface({
  anchorRef: _anchorRef,
  children,
  maxHeight,
  maxWidth,
  minHeight = 0,
  minWidth = 0,
  onClose,
  padding = "md",
  presentation: _presentation = "centered",
  visible,
}: PopupSurfaceProps) {
  const theme = useTheme();

  // Proven-smooth lifecycle: `rendered` keeps the card mounted through the exit; `ready` gates the
  // entrance until the portal has actually presented (native onShow / web effect).
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

  useOverlayRegistration(visible, onClose);

  // useWindowDimensions (not Dimensions.get) so the dialog re-measures on resize.
  const window = useWindowDimensions();
  // Read in the app tree (under the root SafeAreaProvider), so insets are reliable
  // even though the popup body renders inside the portal's Modal. Centering and the
  // size caps are computed against the SAFE region — not the raw window — so the
  // dialog stays within the notch/status-bar/home-indicator bounds rather than
  // spanning the whole device screen.
  const insets = useSafeAreaInsets();
  // Live keyboard metrics so the dialog can shrink and re-center ABOVE the keyboard
  // when an input inside it (e.g. the select's custom field) is focused — same
  // manual avoidance the full-screen modal uses, since KeyboardAvoidingView is
  // unreliable inside a native Modal/overlay. No-op on web (no keyboard events).
  const { height: keyboardHeight, screenY: keyboardScreenY } =
    useKeyboardHeight();
  const keyboardUp = keyboardHeight > 0;
  // Roomier default cap on large screens; an explicit maxWidth always wins.
  const resolvedMaxWidth = maxWidth ?? (window.width >= 768 ? 720 : 560);
  // Bottom of the usable region: just above the keyboard when it's up (clamp by
  // window height so it's right whether or not the modal's window already shrank),
  // otherwise the bottom safe inset.
  const usableBottom = keyboardUp
    ? Math.min(window.height, keyboardScreenY) - WINDOW_PADDING
    : window.height - insets.bottom - WINDOW_PADDING;
  const padTop = insets.top + WINDOW_PADDING;
  // Push the centered content up off the keyboard (or down off the nav bar).
  const padBottom = window.height - usableBottom;
  const padLeft = insets.left + WINDOW_PADDING;
  const padRight = insets.right + WINDOW_PADDING;
  const availableWidth = window.width - padLeft - padRight;
  // Floor keeps a usable popup even under a tall keyboard (it scrolls inside).
  const availableHeight = Math.max(usableBottom - padTop, 160);
  const resolvedMaxHeight = maxHeight
    ? Math.min(maxHeight, availableHeight)
    : availableHeight;

  // Gate on `rendered` (not `visible`) so the exit can finish before the tree unmounts.
  if (!rendered) {
    return null;
  }

  const overlayBody = (
    <>
      <PopupBackdrop onPress={onClose} shown={shown} />

      {/* Full-screen centering layer is a PLAIN View — pointerEvents as a prop (not a style key) so an
          outside tap falls through to the backdrop. It is NOT animated: only the PopoverTransition
          card below animates, composited on its own region (smooth on native). */}
      <View
        pointerEvents="box-none"
        className="absolute inset-0 items-center justify-center"
        style={{
          paddingTop: padTop,
          paddingBottom: padBottom,
          paddingLeft: padLeft,
          paddingRight: padRight,
        }}
      >
        {/* Single PopoverTransition card node (grow + fade) hugging the self-sized FormSurface. */}
        <PopoverTransition
          onExitComplete={() => setRendered(false)}
          visible={shown}
        >
          <FormSurface
            className="w-full"
            motion="none"
            padding={padding}
            tone="raised"
            // boxShadow (NOT elevation): fades with the dialog's opacity and won't flicker a map
            // underneath — see theme.shadow.overlay / PopoverTransition invariants.
            style={{
              boxShadow: theme.shadow.overlay.boxShadow,
              maxHeight: resolvedMaxHeight,
              minHeight: Math.min(minHeight, availableHeight),
              minWidth: Math.min(minWidth, availableWidth),
              width: Math.min(resolvedMaxWidth, availableWidth),
              zIndex: 70,
            }}
          >
            {children}
          </FormSurface>
        </PopoverTransition>
      </View>
    </>
  );

  return (
    <OverlayPortal
      active={visible}
      animationType="none"
      onRequestClose={onClose}
      onShow={() => setReady(true)}
      visible
    >
      {overlayBody}
    </OverlayPortal>
  );
}

// The dim backdrop — own component so its ready-gated fade state can't re-render the card. Matches
// the delete alert (fast-in on the ready gate / normal-out), so the scrim fades in step with the card.
function PopupBackdrop({
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
      accessibilityLabel="Close popup"
      accessibilityRole="button"
      className="absolute inset-0 bg-surface-overlay"
      onPress={onPress}
      style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}
    />
  );
}
