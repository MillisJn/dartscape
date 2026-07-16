import { buildNativeWindThemeVars } from "@spatch-kit/theme/nativewind";
import { useTheme } from "@spatch-kit/theme/provider";
import { VariableContextProvider } from "nativewind";
import { useMemo, type PropsWithChildren } from "react";

/**
 * Bridges the kit's runtime theme (any accent hex, light/dark, density, ...) into Tailwind as
 * --fp-* CSS custom properties via nativewind's VariableContextProvider — global.css's `@theme
 * inline` block's color/spacing/radius entries all resolve through var(--fp-*), so this is the one
 * place the two systems meet. Memoized on `theme`: rebuilding the vars object in the render body
 * would hand the provider a brand-new value every render, invalidating the styling context (every
 * `className` in the app) for a theme that hadn't actually changed.
 *
 * No wrapping View here — SafeAreaProvider (above this in the tree) already renders its own
 * flex:1 container. OverlayPortal re-injects the same vars onto the portalled root (see its
 * .web.tsx) because a portal renders outside this wrapper's tree — that's the kit's half of this
 * same mechanism.
 */
export function ThemeVarsRoot({ children }: PropsWithChildren) {
  const theme = useTheme();
  const nativeWindThemeVars = useMemo(() => buildNativeWindThemeVars(theme), [theme]);
  return (
    <VariableContextProvider value={nativeWindThemeVars}>{children}</VariableContextProvider>
  );
}
