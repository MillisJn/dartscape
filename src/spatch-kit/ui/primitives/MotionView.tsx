import { useEffect, useRef, type PropsWithChildren } from "react";
import {
  Animated,
  Easing,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";

export type MotionPreset = "none" | "fade" | "rise";

type MotionViewProps = PropsWithChildren<{
  className?: string;
  preset?: MotionPreset;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

function MotionViewBase({
  children,
  className,
  preset = "none",
  delay = 0,
  style,
}: MotionViewProps) {
  const theme = useTheme();
  const useNativeDriver = Platform.OS !== "web";
  const hasAnimatedRef = useRef(false);
  // Initialize to the HIDDEN start state when an entrance will play, so the first painted frame is
  // already hidden. Otherwise the values start at 1 (visible), paint one visible frame, then the
  // effect snaps them to 0 and animates in — a flash on web / an abrupt "click-in" on native.
  const startHidden = preset !== "none" && theme.motion.enabled;
  const opacity = useRef(new Animated.Value(startHidden ? 0 : 1)).current;
  const scale = useRef(
    new Animated.Value(startHidden ? (preset === "rise" ? 0.985 : 0.992) : 1),
  ).current;
  const translateY = useRef(
    new Animated.Value(startHidden ? (preset === "rise" ? 10 : 4) : 0),
  ).current;

  useEffect(() => {
    if (preset === "none" || !theme.motion.enabled) {
      hasAnimatedRef.current = true;
      opacity.setValue(1);
      scale.setValue(1);
      translateY.setValue(0);
      return;
    }

    if (hasAnimatedRef.current) {
      opacity.setValue(1);
      scale.setValue(1);
      translateY.setValue(0);
      return;
    }

    hasAnimatedRef.current = true;
    opacity.setValue(preset === "fade" || preset === "rise" ? 0 : 1);
    scale.setValue(preset === "rise" ? 0.985 : 0.992);
    translateY.setValue(preset === "rise" ? 10 : 4);

    // Deterministic timing curves (no spring) so entrances settle without an overshoot/bounce.
    // This matters most for overlay surfaces (menus/popovers use the "rise" preset) where a
    // bounce reads as jank; for business UI predictable beats playful.
    const animations = [
      Animated.timing(opacity, {
        delay,
        duration: theme.motion.duration.fast,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver,
      }),
      Animated.timing(scale, {
        delay,
        duration: theme.motion.duration.fast,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        delay,
        duration: theme.motion.duration.normal,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver,
      }),
    ];

    const animation = Animated.parallel(animations);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    delay,
    hasAnimatedRef,
    opacity,
    preset,
    theme.motion.duration.fast,
    theme.motion.duration.normal,
    theme.motion.enabled,
    scale,
    translateY,
    useNativeDriver,
  ]);

  return (
    <Animated.View
      className={className}
      style={[
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// See Screen.tsx's comment — nativewind@4 has no styled(), and MotionViewBase already forwards
// className to an inner host component, so the wrapper was a no-op.
export const MotionView = MotionViewBase;
