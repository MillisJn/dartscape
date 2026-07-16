import { Platform } from "react-native";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { MotionView, type MotionPreset } from "@spatch-kit/ui/primitives/MotionView";

type PaddingSize = "none" | "sm" | "md" | "lg";
// "plain" uses the page background — for a container that holds its own inner cards, so those cards
// (on `surface`) stand out against it instead of blending into another surface.
type SurfaceTone = "default" | "muted" | "raised" | "plain";

type SurfaceProps = PropsWithChildren<{
  className?: string;
  padding?: PaddingSize;
  tone?: SurfaceTone;
  motion?: MotionPreset;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

function SurfaceBase({
  children,
  padding = "md",
  tone = "default",
  motion = "none",
  delay = 0,
  className,
  style,
}: SurfaceProps) {
  const theme = useTheme();

  const paddingClassName = {
    none: "",
    sm: "p-app-sm",
    md: "p-app-md",
    lg: "p-app-lg",
  }[padding];

  const toneClassName = {
    default: "bg-surface",
    muted: "bg-surface-muted",
    raised: "bg-surface-raised",
    plain: "bg-background",
  }[tone];

  const backgroundColor = {
    default: theme.colors.surface,
    muted: theme.colors.surfaceMuted,
    raised: theme.colors.surfaceRaised,
    plain: theme.colors.background,
  }[tone];

  const baseStyle: ViewStyle = {
    backgroundColor,
  };

  return (
    <MotionView
      className={[paddingClassName, toneClassName, className]
        .filter(Boolean)
        .join(" ")}
      preset={motion}
      delay={delay}
      style={[baseStyle, style]}
    >
      {children}
    </MotionView>
  );
}

// See Screen.tsx's comment — nativewind@4 has no styled(), and SurfaceBase already forwards
// className to an inner host component, so the wrapper was a no-op.
export const Surface = SurfaceBase;
