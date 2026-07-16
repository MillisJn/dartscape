// Loading skeletons (ghost shells). ONE animated primitive — `Skeleton` — plus two thin layout
// helpers (`SkeletonText`, `SkeletonCircle`) that compose it. Surface-specific skeletons (table
// rows, dashboard cards, …) must ALSO compose these rather than re-implement the shimmer, so the
// animation lives in exactly one place (see docs/web-loading-pipeline.md, C5).
//
// The shimmer is a soft highlight band sweeping left→right via the basic Animated API (matching
// MotionView's approach). It RESPECTS REDUCED MOTION: when theme.motion.enabled is false the block
// renders static, no animation. Zero-layout-shift is the caller's job (match the real row's
// padding/line-height); SkeletonText helps by sizing each line to a text variant's line box.
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@spatch-kit/theme/provider";
import type { AppTheme } from "@spatch-kit/theme/theme";
import type { TextVariant } from "@spatch-kit/ui/primitives/AppText";

const SHIMMER_DURATION_MS = 1200;
// The sweeping highlight band, picked to CONTRAST with surfaceMuted on each base. A white band
// reads on the dark surface but is invisible on the near-white light surface (#F7F8F5) — the
// original bug — so on light we sweep a translucent DARK band instead. Both are 3-stop
// transparent→band→transparent so the highlight fades in and out as it travels.
const SHIMMER_BAND_LIGHT = [
  "rgba(0,0,0,0)",
  "rgba(0,0,0,0.10)",
  "rgba(0,0,0,0)",
] as const;
const SHIMMER_BAND_DARK = [
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.28)",
  "rgba(255,255,255,0)",
] as const;

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = "100%", height = 12, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const animate = theme.motion.enabled;
  const shimmerColors =
    theme.appearance === "dark" ? SHIMMER_BAND_DARK : SHIMMER_BAND_LIGHT;
  const progress = useRef(new Animated.Value(0)).current;
  // Measured pixel width drives the sweep distance; until laid out we render a static block.
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    if (!animate || measuredWidth === 0 || Platform.OS !== "web") {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        // RN-Web has no native driver; transform animations run on the UI thread on native.
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, measuredWidth, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setMeasuredWidth((current) => (current === next ? current : next));
  };

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-measuredWidth, measuredWidth],
  });

  // Skeletons are a WEB-ONLY loading affordance. Native data (local SQLite/FTS) resolves within a
  // frame, so a ghost shell would only flash — we render NO skeleton on native, ever.
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.surfaceMuted,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {animate && measuredWidth > 0 ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={shimmerColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Per-variant line box + ink height, mirroring AppText's variantLineHeight so a skeleton line
// occupies the EXACT vertical space the real text would — the key to no layout shift.
function lineMetrics(
  theme: AppTheme,
  variant: TextVariant,
): { line: number; font: number } {
  switch (variant) {
    case "hero":
      return { line: theme.type.heroLineHeight, font: theme.type.hero };
    case "title":
      return { line: theme.type.titleLineHeight, font: theme.type.title };
    case "sectionTitle":
      return { line: theme.type.bodyLineHeight, font: theme.type.sectionTitle };
    case "label":
    case "option":
      return { line: theme.type.bodyLineHeight, font: theme.type.label };
    case "body":
    case "bodyMuted":
      return { line: theme.type.bodyLineHeight, font: theme.type.body };
    case "caption":
      return { line: theme.type.body, font: theme.type.caption };
    case "eyebrow":
    default:
      return { line: Math.round(theme.type.eyebrow * 1.3), font: theme.type.eyebrow };
  }
}

type SkeletonTextProps = {
  variant?: TextVariant;
  // Fraction of the available width the bar fills (0–1). Vary it per line for a natural look.
  widthFraction?: number;
  style?: StyleProp<ViewStyle>;
};

// A single skeleton text line: a line-box-tall container (so the row height matches AppText
// exactly) holding a thinner, vertically-centered bar.
export function SkeletonText({
  variant = "body",
  widthFraction = 1,
  style,
}: SkeletonTextProps) {
  const theme = useTheme();
  // Web-only (see Skeleton): native renders nothing rather than reserving an empty ghost line.
  if (Platform.OS !== "web") {
    return null;
  }
  const { line, font } = lineMetrics(theme, variant);
  const barHeight = Math.max(8, Math.round(font * 0.72));
  const width = `${Math.min(100, Math.max(0, widthFraction * 100))}%` as DimensionValue;

  return (
    <View style={[{ height: line, justifyContent: "center" }, style]}>
      <Skeleton width={width} height={barHeight} radius={theme.radius.sm} />
    </View>
  );
}

type SkeletonCircleProps = {
  size: number;
  style?: StyleProp<ViewStyle>;
};

// A circular skeleton (avatars, status dots). Matches an Avatar of the same `size`.
export function SkeletonCircle({ size, style }: SkeletonCircleProps) {
  // Web-only (see Skeleton): no ghost avatar on native.
  if (Platform.OS !== "web") {
    return null;
  }
  return <Skeleton width={size} height={size} radius={size / 2} style={style} />;
}
