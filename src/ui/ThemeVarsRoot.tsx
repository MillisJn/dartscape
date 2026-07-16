import { buildNativeWindThemeVars } from "@spatch-kit/theme/nativewind";
import { useTheme } from "@spatch-kit/theme/provider";
import { vars } from "nativewind";
import type { PropsWithChildren } from "react";
import { View } from "react-native";

/**
 * Bridges the kit's runtime theme (any accent hex, light/dark, density, ...) into Tailwind as
 * --fp-* CSS custom properties via nativewind's vars() — tailwind.config.js's color/spacing/radius
 * extensions all resolve through var(--fp-*), so this is the one place the two systems meet.
 *
 * OverlayPortal re-injects the same vars onto the portalled root (see its .web.tsx) because a
 * portal renders outside this wrapper's tree — that's the kit's half of this same mechanism.
 */
export function ThemeVarsRoot({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[{ flex: 1 }, vars(buildNativeWindThemeVars(theme))]}>{children}</View>;
}
