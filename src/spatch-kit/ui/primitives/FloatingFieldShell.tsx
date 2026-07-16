import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Animated,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";

type FloatingFieldShellRenderArgs = {
  contentPaddingTop: number;
};

type FloatingFieldShellProps = {
  caption?: string;
  children: (args: FloatingFieldShellRenderArgs) => ReactNode;
  className?: string;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  errorMessage?: string | null;
  invalid?: boolean;
  isFloating?: boolean;
  label?: string;
  labelInsetLeft?: number;
  labelMode?: "floating" | "static";
  // Resting `top` of the floating label (where it sits as a placeholder) and the
  // `top` it animates to once floated. Driven by the field so the label lines up
  // with the value text and the reserved label lane.
  labelRestTop?: number;
  labelFloatTop?: number;
};

function FloatingFieldShellBase({
  caption,
  children,
  className,
  containerStyle,
  disabled = false,
  errorMessage,
  invalid = false,
  isFloating = false,
  label,
  labelInsetLeft,
  labelMode = "floating",
  labelRestTop,
  labelFloatTop,
}: FloatingFieldShellProps) {
  const theme = useTheme();
  const progress = useRef(
    new Animated.Value(labelMode === "floating" && isFloating ? 1 : 0),
  ).current;

  useLayoutEffect(() => {
    if (labelMode !== "floating") {
      return;
    }

    Animated.timing(progress, {
      duration: theme.motion.preference === "reduced" ? 0 : 160,
      toValue: isFloating ? 1 : 0,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [isFloating, labelMode, progress, theme.motion.preference]);

  const fieldInsetX = labelInsetLeft ?? theme.space.sm + theme.borderWidth.sm;
  const restTop = labelRestTop ?? theme.space.md;
  const floatTop = labelFloatTop ?? restTop - theme.space.sm;
  const staticLabelTop = Math.max(theme.space.xs, 1);
  const contentPaddingTop = !label
    ? 0
    : labelMode === "static"
      ? theme.space.xl
      : isFloating
        ? theme.space.lg
        : 0;

  const LABEL_SCALE = 0.82;

  const animatedLabelStyle = useMemo(
    () => ({
      left: fieldInsetX,
      position: "absolute" as const,
      top: restTop,
      // Scale the floated label around its LEFT edge so the left origin stays put. The old
      // approach scaled around center and corrected with a translateX derived from the measured
      // label width — which started at a fallback and changed once onLayout reported the real
      // width, making the label visibly jump sideways on mount. transformOrigin needs no
      // measurement, so the label never shifts.
      transformOrigin: "left center",
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, floatTop - restTop],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, LABEL_SCALE],
          }),
        },
      ],
      zIndex: 2,
    }),
    [progress, fieldInsetX, restTop, floatTop],
  );

  return (
    <View className={["gap-1", className].filter(Boolean).join(" ")}>
      <View className="relative" style={containerStyle}>
        {children({ contentPaddingTop })}
        {label && labelMode === "floating" ? (
          <Animated.View pointerEvents="none" style={animatedLabelStyle}>
            <AppText
              color={
                invalid ? "danger" : disabled ? "inputPlaceholder" : "mutedText"
              }
              style={Platform.OS === "web" ? { userSelect: "none" } : undefined}
              variant="body"
            >
              {label}
            </AppText>
          </Animated.View>
        ) : label ? (
          <View
            pointerEvents="none"
            style={{
              left: fieldInsetX,
              position: "absolute",
              top: staticLabelTop,
              zIndex: 2,
            }}
          >
            <AppText
              color={
                invalid ? "danger" : disabled ? "inputPlaceholder" : "mutedText"
              }
              style={Platform.OS === "web" ? { userSelect: "none" } : undefined}
              variant="caption"
            >
              {label}
            </AppText>
          </View>
        ) : null}
      </View>

      {errorMessage ? (
        <AppText color="danger" variant="caption">
          {errorMessage}
        </AppText>
      ) : caption ? (
        <AppText variant="caption" className="px-1">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

// See Screen.tsx's comment — nativewind@4 has no styled(), and FloatingFieldShellBase already
// forwards className to an inner host View, so the wrapper was a no-op.
export const FloatingFieldShell = FloatingFieldShellBase;
