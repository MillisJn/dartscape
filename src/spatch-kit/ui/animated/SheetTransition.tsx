// Slide-up sibling of PopoverTransition — the SAME proven lifecycle (mount at hidden, run the ENTER
// in a SEPARATE effect one commit after mount, keep children mounted through the exit, native driver)
// but animating opacity + translateY instead of opacity + scale. Used for bottom-sheet / full-screen
// slide-up surfaces so they get the exact same smoothness as the centered dialogs (the delete alert /
// profile menu). See PopoverTransition for the full rationale behind each invariant.
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";

type Props = {
  visible: boolean;
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  /** Fired once the ENTER animation fully finishes (genuine finish only). */
  onEnterComplete?: () => void;
  /** Fired once the exit animation finishes and the content has unmounted. */
  onExitComplete?: () => void;
};

export function SheetTransition({
  visible,
  children,
  className,
  style,
  pointerEvents,
  onEnterComplete,
  onExitComplete,
}: Props) {
  const theme = useTheme();
  const useNativeDriver = Platform.OS !== "web";
  const window = useWindowDimensions();

  const ANIM_SPEED = theme.motion.duration.slow; // 1.5x the default slow duration, same as PopoverTransition

  // Slide distance = the sheet's own measured height (so it slides a natural distance from just off
  // the bottom edge), falling back to the window height until measured so it always starts fully
  // off-screen. Kept in a ref so refining it never resets the native animation.
  const slideDistanceRef = useRef(window.height);

  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(
    new Animated.Value(visible ? 0 : slideDistanceRef.current),
  ).current;
  const [rendered, setRendered] = useState(visible);

  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;
  const onEnterCompleteRef = useRef(onEnterComplete);
  onEnterCompleteRef.current = onEnterComplete;
  // Guards a spurious exit on first mount in the hidden state (see PopoverTransition).
  const hasEnteredRef = useRef(false);

  const handleLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      slideDistanceRef.current = height;
      // Re-seat the hidden position to the measured height while still hidden, so the first enter
      // slides a natural distance rather than the full window height.
      if (!hasEnteredRef.current && !visible) {
        translateY.setValue(height);
      }
    }
  };

  // MOUNT / EXIT lifecycle. Mount immediately when visible; on hide, play the exit slide-down then
  // unmount. The ENTER is NOT started here — see the separate effect below.
  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    if (!hasEnteredRef.current) {
      return;
    }
    if (!theme.motion.enabled) {
      opacity.setValue(0);
      translateY.setValue(slideDistanceRef.current);
      setRendered(false);
      onExitCompleteRef.current?.();
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        duration: ANIM_SPEED,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        duration: ANIM_SPEED,
        easing: Easing.in(Easing.cubic),
        toValue: slideDistanceRef.current,
        useNativeDriver,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) {
        setRendered(false);
        onExitCompleteRef.current?.();
      }
    });
    return () => anim.stop();
  }, [
    visible,
    opacity,
    translateY,
    ANIM_SPEED,
    theme.motion.enabled,
    useNativeDriver,
  ]);

  // ENTER — runs only AFTER the view is committed (`rendered`), never in the mount pass (see
  // PopoverTransition). Slides up from the resting-below position + fades in.
  useEffect(() => {
    if (!rendered || !visible) {
      return;
    }
    hasEnteredRef.current = true;
    if (!theme.motion.enabled) {
      opacity.setValue(1);
      translateY.setValue(0);
      onEnterCompleteRef.current?.();
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        duration: ANIM_SPEED,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        duration: ANIM_SPEED,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onEnterCompleteRef.current?.();
    });
    return () => anim.stop();
  }, [
    rendered,
    visible,
    opacity,
    translateY,
    ANIM_SPEED,
    theme.motion.enabled,
    useNativeDriver,
  ]);

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View
      className={className}
      onLayout={handleLayout}
      pointerEvents={pointerEvents}
      style={[{ opacity, transform: [{ translateY }] }, style]}
    >
      {children}
    </Animated.View>
  );
}
