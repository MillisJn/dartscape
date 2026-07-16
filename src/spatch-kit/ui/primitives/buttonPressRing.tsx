import { useRef } from "react";
import { Animated } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { animatePressProgress } from "@spatch-kit/ui/primitives/pressMotion";

// The shared button PRESS animation: a focus ring that fades in on hover (web) or press and expands
// outward while held. Used by ButtonSurface AND FloatingActionButton so they animate identically —
// the hook owns the two drivers + interpolations + timing; the consumer wires the returned handlers
// onto its Pressable and renders <ButtonFocusRing> with its own corner radius (via className).

export type ButtonPressRingOptions = {
  // How far (px) the ring grows OUTSIDE the face edge while pressed. Default 2. 0 keeps it flush.
  expand?: number;
  // Ring opacity at full hover/press. Default 1.
  maxOpacity?: number;
  // Only light the ring on PRESS, not on hover (e.g. a surface that already has its own hover style).
  // Default false (hover + press).
  pressOnly?: boolean;
  // Override the enter/settle timing (ms). Default: the theme's fast/normal motion durations.
  fastDuration?: number;
  normalDuration?: number;
};

export function useButtonPressRing({
  expand = 2,
  maxOpacity = 1,
  pressOnly = false,
  fastDuration,
  normalDuration,
}: ButtonPressRingOptions = {}) {
  const theme = useTheme();
  const reducedMotion = theme.motion.preference === "reduced";
  const hoverProgress = useRef(new Animated.Value(0)).current;
  const pressProgress = useRef(new Animated.Value(0)).current;

  // Ring lights up on hover OR press (clamped so hovering-then-pressing doesn't double up); the
  // outward inset is press-only — flush on the border at rest, `expand`px outside it while held.
  const ringDriver = pressOnly
    ? pressProgress
    : Animated.add(hoverProgress, pressProgress);
  const ringOpacity = ringDriver.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxOpacity],
    extrapolate: "clamp",
  });
  const ringInset = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -expand],
  });

  const drive = (value: Animated.Value, toValue: number) =>
    animatePressProgress(
      value,
      toValue,
      reducedMotion,
      fastDuration ?? theme.motion.duration.fast,
      normalDuration ?? theme.motion.duration.normal,
    );

  return {
    ringOpacity,
    ringInset,
    // Consumers compose these with their own logic (tooltip, disabled guards).
    onHoverIn: () => drive(hoverProgress, 1),
    onHoverOut: () => drive(hoverProgress, 0),
    onPressIn: () => drive(pressProgress, 1),
    onPressOut: () => drive(pressProgress, 0),
  };
}

// The ring itself. Absolutely positioned, non-interactive; the corner radius comes from `className`
// (rounded-app-sm for buttons, rounded-app-pill for the circular FAB) so one component fits both.
export function ButtonFocusRing({
  className,
  inset,
  opacity,
  color,
  borderWidth,
}: {
  className?: string;
  inset: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
  // Override the ring color / thickness. Default: the theme focus-ring color at md border width.
  color?: string;
  borderWidth?: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      className={className}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: inset,
        left: inset,
        right: inset,
        bottom: inset,
        borderColor: color ?? theme.colors.focusRing,
        borderWidth: borderWidth ?? theme.borderWidth.md,
        opacity,
      }}
    />
  );
}
