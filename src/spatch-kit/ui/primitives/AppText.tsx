import type { PropsWithChildren } from "react";
import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import type { AppTheme } from "@spatch-kit/theme/theme";

export type TextVariant =
  | "eyebrow"
  | "hero"
  | "title"
  | "sectionTitle"
  | "body"
  | "bodyMuted"
  | "label"
  | "option"
  | "caption";

type AppTextProps = PropsWithChildren<
  TextProps & {
    variant?: TextVariant;
    color?: keyof AppTheme["colors"];
    className?: string;
    style?: StyleProp<TextStyle>;
  }
>;

function AppTextBase({
  children,
  variant = "body",
  color,
  className,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();

  const variantFontFamily: Record<TextVariant, string> = {
    eyebrow: theme.fonts.sansBold,
    hero: theme.fonts.display,
    title: theme.fonts.display,
    sectionTitle: theme.fonts.sansBold,
    body: theme.fonts.sansMedium,
    bodyMuted: theme.fonts.sansMedium,
    label: theme.fonts.sansBold,
    option: theme.fonts.sansBold,
    caption: theme.fonts.sansMedium,
  };

  const variantClassName: Record<TextVariant, string> = {
    eyebrow:
      "font-sans text-app-eyebrow font-bold uppercase tracking-app-eyebrow",
    hero: "font-ibm text-app-hero font-bold",
    title: "font-display text-app-title font-bold",
    sectionTitle: "font-sans text-app-section font-bold tracking-[0.01em]",
    body: "font-sans text-app-body font-medium",
    bodyMuted: "font-sans text-app-body font-medium",
    label: "font-sans text-app-label font-bold tracking-[0.01em]",
    option: "font-sans text-app-label font-bold tracking-[0.01em]",
    caption: "font-sans text-app-caption font-medium",
  };

  const variantLineHeight: Partial<Record<TextVariant, number>> = {
    hero: theme.type.heroLineHeight,
    title: theme.type.titleLineHeight,
    sectionTitle: theme.type.bodyLineHeight,
    body: theme.type.bodyLineHeight,
    bodyMuted: theme.type.bodyLineHeight,
    label: theme.type.bodyLineHeight,
    option: theme.type.bodyLineHeight,
    caption: theme.type.body,
  };

  const variantColor: Record<TextVariant, keyof AppTheme["colors"]> = {
    eyebrow: "accent",
    hero: "text",
    title: "text",
    sectionTitle: "text",
    body: "text",
    bodyMuted: "mutedText",
    label: "text",
    option: "text",
    caption: "mutedText",
  };

  return (
    <Text
      className={[variantClassName[variant], className]
        .filter(Boolean)
        .join(" ")}
      style={[
        { color: theme.colors[color ?? variantColor[variant]] },
        { fontFamily: variantFontFamily[variant] },
        variantLineHeight[variant] == null
          ? null
          : { lineHeight: variantLineHeight[variant] },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// See Screen.tsx's comment — nativewind@4 has no styled(), and AppTextBase already forwards
// className to an inner host Text, so the wrapper was a no-op.
export const AppText = AppTextBase;
