import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";

import { useTheme } from "@spatch-kit/theme/provider";

type CrossfadeSwapProps = {
  /**
   * When this value changes, the current content animates out while the new
   * content animates in. The outgoing instance is kept mounted by Reanimated
   * for the duration of its exit animation, so there is no blank frame, no
   * remount, and no double-load flicker.
   */
  transitionKey: string;
  children: ReactNode;
  /**
   * Stretch to fill the parent (flex: 1). Use for fixed-height regions such as
   * a results list or a full-screen section, so the incoming and outgoing
   * layers can overlap cleanly. Leave off for in-flow content (e.g. tab bodies
   * inside a scroll view) so the height tracks the content.
   */
  fill?: boolean;
  /**
   * Slide the new content in while the old slides out ("move over"), instead of
   * a crossfade. Only meaningful with `fill`. Direction follows `slideDirection`.
   */
  slide?: boolean;
  /**
   * For `slide`: "forward" (default) slides the new content in from the right;
   * "back" slides it in from the left — so a day/page transition can move the
   * right way regardless of how far the target is.
   */
  slideDirection?: "back" | "forward";
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function CrossfadeSwap({
  transitionKey,
  children,
  fill = false,
  slide = false,
  slideDirection = "forward",
  className,
  style,
}: CrossfadeSwapProps) {
  const theme = useTheme();
  const duration = theme.motion.duration.normal;

  // Only animate genuine swaps, never the first appearance. On initial mount
  // there is no outgoing content, so a slide-in is gratuitous — and worse, when
  // the host (e.g. the Search tab) is itself lazily mounting behind a tab
  // transition the layer's width isn't settled yet, so the slide gets stranded
  // partway and never reaches its resting position. Suppress `entering` on the
  // first mount; `exiting` stays armed so the first layer can still slide out
  // once a real swap occurs.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);
  const isInitialMount = !hasMountedRef.current;

  if (!theme.motion.enabled) {
    return (
      <View className={className} style={[fill ? styles.fill : null, style]}>
        {children}
      </View>
    );
  }

  const useSlide = slide && fill;
  const forward = slideDirection !== "back";
  const entering = isInitialMount
    ? undefined
    : useSlide
      ? (forward ? SlideInRight : SlideInLeft).duration(duration)
      : FadeIn.duration(duration);
  const exiting = useSlide
    ? (forward ? SlideOutLeft : SlideOutRight).duration(duration)
    : FadeOut.duration(duration);

  return (
    <View className={className} style={[fill ? styles.fill : null, style]}>
      <Animated.View
        key={transitionKey}
        entering={entering}
        exiting={exiting}
        style={fill ? styles.absoluteFill : undefined}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  fill: { flex: 1 },
});
