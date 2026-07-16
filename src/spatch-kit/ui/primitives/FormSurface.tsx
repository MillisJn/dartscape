import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@spatch-kit/theme/provider";
import type { MotionPreset } from "@spatch-kit/ui/primitives/MotionView";
import { Surface } from "@spatch-kit/ui/primitives/Surface";

type FormSurfaceProps = PropsWithChildren<{
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "default" | "muted" | "raised" | "plain";
  motion?: MotionPreset;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function FormSurface({
  children,
  className,
  padding = "md",
  tone = "default",
  motion = "none",
  delay = 0,
  style,
}: FormSurfaceProps) {
  const theme = useTheme();

  return (
    <Surface
      className={[
        "overflow-hidden rounded-app-lg border border-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      delay={delay}
      motion={motion}
      padding={padding}
      // The rounded corners / border / clip are ALSO set inline because on web NativeWind doesn't
      // reliably apply className styles through the styled-Animated MotionView underneath Surface
      // (colors survive only via Surface's inline backgroundColor). Without this, portaled overlays
      // and menus render square/borderless on web. Inline styles reach the DOM node directly;
      // native is unchanged (same values as the classes above). Caller `style` still wins.
      style={[
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          borderWidth: theme.borderWidth.sm,
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
