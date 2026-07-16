import { Animated, Easing } from "react-native";

// Shared hover/press animation driver used by the interactive button primitives (ButtonSurface,
// IconButton). Drives a 0→1 `Animated.Value` that components interpolate into a hover tint, a press
// scale, or a focus ring. Extracted from Button so every pressable feels identical.
//
// `reducedMotion` snaps instantly (duration 0) so the reduce-motion preference is honored without
// per-call branching. Entering (toValue 1) is a touch quicker than settling back (toValue 0), which
// reads as responsive on press-in and gentle on release.
//
// useNativeDriver is false: callers may map this value onto layout props (the button ring's inset),
// which the native driver can't animate. Opacity/transform still animate fine off the JS driver —
// on web that's exactly what react-native-web writes to inline styles.
export function animatePressProgress(
  value: Animated.Value,
  toValue: number,
  reducedMotion: boolean,
  fastDuration: number,
  normalDuration: number,
) {
  Animated.timing(value, {
    duration: reducedMotion ? 0 : toValue === 1 ? fastDuration : normalDuration,
    easing: toValue === 1 ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
    toValue,
    useNativeDriver: false,
  }).start();
}
