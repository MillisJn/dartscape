import { type PropsWithChildren, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";

// Instant press-down feedback for large tappable SURFACES: entity cards get a subtle scale, while
// list rows and nav tabs get an accent tint that fades in/out. Distinct from pressMotion (the button
// primitives): this drives a 0→1 value on the NATIVE driver on native — it only touches transform and
// opacity, so the tap-down stays smooth on the UI thread even mid-scroll or while the JS thread builds
// the next screen. Web keeps the JS driver (react-native-web snaps native-driven animations). Feedback
// fires on press-IN (finger down), not press (release), and honors reduce-motion (snaps instantly).
//
// FINGER-TRACKING RELEASE: the press-down plays while the finger is down and springs back the instant
// it lifts, interrupting an unfinished down from wherever it got to. It deliberately does NOT defer the
// release until the down animation finishes: because the tap action now fires immediately on release
// (the surface opens/navigates right away), a deferred release plays the card's whole down→up AFTER the
// finger is up and the popup is already sliding in — which reads as the card "clicking back in" a second
// time. Tracking the finger keeps the press glued to the touch, so it never animates after release.

// Scroll rows should DELAY the feedback slightly so beginning a scroll doesn't flash the tint on every
// touch — only a finger that lingers (a real tap) triggers it. Pass this to a Pressable's
// `unstable_pressDelay`. Standalone tabs (never scrolled) want no delay, so they omit it.
export const PRESS_FEEDBACK_DELAY_MS = 70;

const PRESS_SCALE_MIN = 0.97;
const PRESS_TINT_MAX_OPACITY = 0.12;

// Web-only: ease hover/selection BACKGROUND changes so they fade in/out instead of snapping —
// matching the DataTable rows (native has no CSS transitions and snaps native-driven animations, so
// this is a no-op there). Menu items and settings rows carry `hover:bg-*` classes; this makes those
// washes glide. Exported so surfaces that don't use PressableTint (e.g. custom rows) can apply it too.
export const webHoverBgTransition: StyleProp<ViewStyle> =
  Platform.OS === "web"
    ? ({
        transitionDuration: "150ms",
        transitionProperty: "background-color",
      } as unknown as ViewStyle)
    : null;
export function usePressFeedback() {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";
  const motionEnabled = theme.motion.enabled;
  const fast = theme.motion.duration.fast;
  const normal = theme.motion.duration.normal;

  const animateUp = () => {
    if (!motionEnabled) {
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: normal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  };

  const animateDown = () => {
    if (!motionEnabled) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    }).start();
  };

  return {
    progress,
    pressHandlers: {
      onPressIn: () => {
        animateDown();
      },
      // Spring straight back from wherever the down got to — never wait for it to finish (that
      // deferred release is what made the card animate after the finger was already up).
      onPressOut: () => {
        animateUp();
      },
    },
    // Run the tap action IMMEDIATELY on release — no defer — so the surface reacts the instant the
    // finger lifts. The tint pulse above is independent (native driver), so responsiveness and the
    // visual are fully decoupled. Callers route their onPress through this uniformly.
    pressAction: (action?: () => void) => {
      action?.();
    },
  };
}

// Drop-in Pressable with the accent tint built in — for tabs, menu items, and settings rows that
// don't want to wire the hook by hand. The action always fires immediately on release and the tint
// plays independently (see usePressFeedback). The tint fills the pressable, so give it the row's own
// background/padding via className/style; add rounded + overflow-hidden if the row has rounded corners.
type PressableTintProps = PropsWithChildren<{
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  maxOpacity?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: PressableProps["hitSlop"];
  // Fired on raw touch-down — ahead of `pressDelay`, and ahead of onPress. For warming whatever the
  // tap is about to need, so the work is already done by the time the finger lifts. Must be cheap and
  // idempotent: it also fires for a touch that turns out to be a SCROLL, and on both touch-start and
  // press-in (the latter covers web, where a mouse fires no touch events).
  onPressPrefetch?: () => void;
  // Delay before the tint arms, for a surface inside a ScrollView — pass PRESS_FEEDBACK_DELAY_MS so
  // starting a scroll doesn't flash it. Standalone surfaces (never scrolled) omit it.
  pressDelay?: PressableProps["unstable_pressDelay"];
  pressRetentionOffset?: PressableProps["pressRetentionOffset"];
  accessibilityRole?: PressableProps["accessibilityRole"];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: PressableProps["accessibilityState"];
}>;

export function PressableTint({
  onPress,
  onLongPress,
  disabled = false,
  maxOpacity,
  className,
  style,
  hitSlop,
  onPressPrefetch,
  pressDelay,
  pressRetentionOffset,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  children,
}: PressableTintProps) {
  const { progress, pressHandlers, pressAction } = usePressFeedback();
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      className={className}
      disabled={disabled}
      hitSlop={hitSlop}
      onLongPress={onLongPress}
      onPress={onPress ? () => pressAction(onPress) : undefined}
      // Spread pressHandlers FIRST so these composed handlers win: `pressDelay` holds press-in back,
      // which is exactly the head start onPressPrefetch exists to keep, so it also rides touch-start.
      {...pressHandlers}
      onPressIn={() => {
        onPressPrefetch?.();
        pressHandlers.onPressIn();
      }}
      onTouchStart={onPressPrefetch}
      pressRetentionOffset={pressRetentionOffset}
      // webHoverBgTransition first so a caller's own style (e.g. a selected background) still wins.
      style={[webHoverBgTransition, style]}
      unstable_pressDelay={pressDelay}
    >
      <PressTintOverlay maxOpacity={maxOpacity} progress={progress} />
      {children}
    </Pressable>
  );
}

// Accent tint overlay for list rows and nav tabs — an absolutely-filled layer whose opacity fades in
// on press. Render it as the FIRST child of the row's/cell's background container (so it sits behind
// the content and tints the surface without obscuring anything); it never captures touches.
export function PressTintOverlay({
  progress,
  maxOpacity = PRESS_TINT_MAX_OPACITY,
  style,
}: {
  progress: Animated.Value;
  // How strong the accent wash gets at full press. Rows use the default; nav tabs pass a higher
  // value so the quick tap reads clearly on the bar.
  maxOpacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxOpacity],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.accent, opacity },
        style,
      ]}
    />
  );
}
