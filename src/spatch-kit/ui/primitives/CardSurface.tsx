import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import type { MotionPreset } from "@spatch-kit/ui/primitives/MotionView";
import { Surface } from "@spatch-kit/ui/primitives/Surface";

type CardSurfaceProps = PropsWithChildren<{
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "default" | "muted" | "raised";
  motion?: MotionPreset;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function CardSurface({
  children,
  className,
  padding = "md",
  tone = "default",
  motion = "none",
  delay = 0,
  style,
}: CardSurfaceProps) {
  const theme = useTheme();

  return (
    <Surface
      className={[
        "overflow-hidden rounded-app-sm border border-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      delay={delay}
      motion={motion}
      padding={padding}
      style={[
        {
          // Bleed content (e.g. map previews) opts out via padding="none" so it can
          // reach the rounded edge; every other size keeps the tight card padding.
          ...(padding === "none"
            ? { padding: 0 }
            : {
                paddingBottom: theme.space.xxs,
                paddingTop: theme.space.xxs,
                paddingLeft: theme.space.sm,
                paddingRight: theme.space.sm,
              }),
          // borderColor is set inline (not just via the `border-border` className) because on
          // web NativeWind doesn't reliably apply className colors through the styled-Animated
          // MotionView under Surface, so the className alone leaves RNW's default black border —
          // cards looked nothing like the phone. Matches FormSurface. Caller `style` still wins,
          // so the selected cards override this with borderStrong.
          borderColor: theme.colors.border,
          borderBottomWidth: theme.borderWidth.sm,
          borderLeftWidth: theme.borderWidth.sm,
          borderRadius: theme.radius.lg,
          borderRightWidth: theme.borderWidth.sm,
          borderTopWidth: theme.borderWidth.sm,
          // Inline (not just the `overflow-hidden` className) so bleed media — e.g. the
          // property preview map — clips to the rounded corners on web, where the className
          // doesn't reach the DOM node through MotionView. Matches FormSurface.
          overflow: "hidden",
        },
        style,
      ]}
      tone={tone}
    >
      {children}
    </Surface>
  );
}
