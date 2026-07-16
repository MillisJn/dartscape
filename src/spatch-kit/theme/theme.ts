import { Platform } from "react-native";

import {
  getAccentFamily,
  tintTowardAccent,
  type AppearanceKey,
} from "@spatch-kit/theme/accentUtils";

export type { AppearanceKey } from "@spatch-kit/theme/accentUtils";

export type TextScaleKey = "compact" | "comfortable" | "large";
export type DensityKey = "compact" | "comfortable" | "airy";
export type CornerStyleKey = "square" | "sharp" | "balanced" | "rounded";
export type MotionPreferenceKey = "full" | "reduced";
// How dates render app-wide (detail views + picker fields). See theme/appDateFormat.
export type DateFormatKey = "medium" | "weekday" | "full";

export type ThemeSelection = {
  appearance: AppearanceKey;
  primaryColor: string;
  textScale: TextScaleKey;
  density: DensityKey;
  cornerStyle: CornerStyleKey;
  motion: MotionPreferenceKey;
  // How dates display app-wide (detail views + picker fields).
  dateFormat: DateFormatKey;
  // Whether hover tooltips appear on icon buttons (web only). Gates only the visual bubble — the
  // underlying accessibilityLabel is always set regardless, so screen readers are unaffected.
  showTooltips: boolean;
};

type ThemePalette = {
  appearance: "light" | "dark";
  background: string;
  backgroundMuted: string;
  surface: string;
  surfaceMuted: string;
  // A visible in-family muted surface step (darker than white in light, a subtle band in dark) —
  // used for flat list-section header strips so the header anchors without leaving the surface family.
  surfaceSunken: string;
  surfaceRaised: string;
  surfaceOverlay: string;
  border: string;
  borderStrong: string;
  text: string;
  mutedText: string;
  accent: string;
  accentMuted: string;
  accentContrast: string;
  focusRing: string;
  focusGlow: string;
  success: string;
  warning: string;
  danger: string;
  inputBackground: string;
  inputPlaceholder: string;
};

type ThemeFontFamilies = {
  display: string;
  sans: string;
  sansMedium: string;
  sansBold: string;
  ibm: string;
  mono: string;
};

export type AppTheme = {
  selection: ThemeSelection;
  appearance: "light" | "dark";
  // Convenience mirror of selection.showTooltips so tooltip primitives can gate on `theme.showTooltips`
  // the same way overlay code reads `theme.motion.enabled`.
  showTooltips: boolean;
  colors: ThemePalette;
  fonts: ThemeFontFamilies;
  motion: {
    preference: MotionPreferenceKey;
    enabled: boolean;
    duration: {
      fast: number;
      normal: number;
      slow: number;
    };
    delay: {
      xs: number;
      sm: number;
      md: number;
    };
    spring: {
      damping: number;
      stiffness: number;
    };
  };
  space: {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    // Semantic: the single horizontal content inset shared by every form / detail / list /
    // report / settings surface (everything that references theme.space.gutter). One knob for
    // how far cards & sections sit in from the screen or sheet edge. Currently equal to xxs.
    gutter: number;
    // Semantic: the vertical gap BETWEEN sections, shared by every section-list container so it
    // stays uniform. 0 so flat sections stack flush into one continuous list.
    sectionGap: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  borderWidth: {
    hairline: number;
    sm: number;
    md: number;
  };
  type: {
    eyebrow: number;
    caption: number;
    body: number;
    label: number;
    sectionTitle: number;
    title: number;
    hero: number;
    bodyLineHeight: number;
    titleLineHeight: number;
    heroLineHeight: number;
  };
  shadow: {
    // `boxShadow` (web-only for card/button/focus; undefined on native) gives surfaces real depth on
    // web, where RN's elevation/shadow* props render nothing. react-native-web reads it; native keeps
    // the legacy props. Hand-tuned per semantic level rather than derived from elevation.
    //
    // `overlay` is DIFFERENT: it is boxShadow on BOTH platforms and carries NO elevation. Every
    // floating overlay (menu, dropdown, select, dialog, modal card) must use it instead of
    // theme.shadow.card. Why: (1) an Android `elevation` shadow is drawn by the parent's RenderNode,
    // so it does NOT fade with the surface's own/animated opacity — it lingers as a hard "shadow
    // square" during a fade; boxShadow is painted into the view and fades correctly. (2) An elevated
    // view composited over a map's TextureView makes the map flicker in/out; boxShadow doesn't touch
    // the map surface. RN 0.85 renders boxShadow natively. See PopoverTransition's invariant block.
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
      boxShadow?: string;
    };
    overlay: {
      boxShadow: string;
    };
    button: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
      boxShadow?: string;
    };
    focus: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
      boxShadow?: string;
    };
  };
};

// The non-accent half of a palette. The accent family (accent, accentMuted,
// accentContrast, focusRing, focusGlow) is derived at runtime from the user's
// primary color via getAccentFamily(), so a base palette deliberately omits it.
type BasePalette = Omit<
  ThemePalette,
  "accent" | "accentMuted" | "accentContrast" | "focusRing" | "focusGlow"
>;

// The single source of truth for the default accent. Referenced by the default
// selection, the legacy-preset migration, the picker fallback, and tests — keep
// the literal in exactly one place so a visual-pass tweak only changes here.
export const DEFAULT_PRIMARY_COLOR = "#2f8f4e";

// Light base — a NEUTRAL grey ramp (no baked-in hue). createAppTheme tints the neutral surfaces +
// borders a hair toward the selected accent at runtime, so the greys stay cohesive with any accent.
const BASE_LIGHT_PALETTE: BasePalette = {
  appearance: "light",
  background: "#F3F3F3",
  backgroundMuted: "#E8E8E8",
  border: "#D4D4D4",
  borderStrong: "#A8A8A8",
  danger: "#C75B5B",
  inputBackground: "#FFFFFF",
  inputPlaceholder: "#767676",
  mutedText: "#595959",
  success: "#2F8F4E",
  surface: "#FFFFFF",
  surfaceMuted: "#F7F7F7",
  surfaceSunken: "#F5F5F5",
  surfaceOverlay: "rgba(20, 20, 20, 0.1)",
  surfaceRaised: "#FFFFFF",
  text: "#202020",
  warning: "#B27A28",
};

// Dark base — a NEUTRAL near-black ramp (no hue bias); createAppTheme tints it a hair toward the
// selected accent at runtime, same as light.
const BASE_DARK_PALETTE: BasePalette = {
  appearance: "dark",
  background: "#141414",
  backgroundMuted: "#1D1D1D",
  border: "#2F2F2F",
  borderStrong: "#3E3E3E",
  danger: "#f87171",
  inputBackground: "#1F1F1F",
  inputPlaceholder: "#727272",
  mutedText: "#A0A0A0",
  success: "#4ade80",
  surface: "#1F1F1F",
  surfaceMuted: "#272727",
  surfaceSunken: "#272727",
  surfaceOverlay: "rgba(0, 0, 0, 0.72)",
  surfaceRaised: "#2B2B2B",
  text: "#F5F5F5",
  warning: "#fbbf24",
};

// Curated accent options for the primary-color picker — a full 5×4 grid (20).
// Two sets, because what reads well differs by base: the LIGHT set uses deeper,
// saturated tones that hold contrast on a white surface; the DARK set uses
// brighter, more luminous tones that pop against near-black. Both lead with the
// brand green (so the default sits top-left) then walk the hue wheel (red → warm
// → cool → magenta, then neutrals) so they stay harmonious. Lowercase #rrggbb so
// they compare equal to normalizeHexColor output.
export const ACCENT_SWATCHES_LIGHT: readonly string[] = [
  "#2f8f4e", // forest green (default)
  "#dc2626", // red
  "#ea580c", // orange
  "#d97706", // amber
  "#ca8a04", // yellow
  "#65a30d", // lime
  "#059669", // emerald
  "#0d9488", // teal
  "#0891b2", // cyan
  "#0284c7", // sky
  "#2563eb", // blue
  "#4f46e5", // indigo
  "#7c3aed", // violet
  "#9333ea", // purple
  "#c026d3", // fuchsia
  "#db2777", // pink
  "#e11d48", // rose
  "#9a3412", // sienna
  "#475569", // slate
  "#57534e", // stone
];

export const ACCENT_SWATCHES_DARK: readonly string[] = [
  "#4ade80", // green
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#facc15", // yellow
  "#a3e635", // lime
  "#34d399", // emerald
  "#2dd4bf", // teal
  "#22d3ee", // cyan
  "#38bdf8", // sky
  "#60a5fa", // blue
  "#818cf8", // indigo
  "#a78bfa", // violet
  "#c084fc", // purple
  "#e879f9", // fuchsia
  "#f472b6", // pink
  "#fb7185", // rose
  "#d6a77a", // tan
  "#94a3b8", // slate
  "#a1a1aa", // zinc
];

export function accentSwatchesFor(
  appearance: AppearanceKey,
): readonly string[] {
  return appearance === "dark" ? ACCENT_SWATCHES_DARK : ACCENT_SWATCHES_LIGHT;
}

const textScaleMultiplier: Record<TextScaleKey, number> = {
  compact: 0.92,
  comfortable: 1,
  large: 1.16,
};

const densityMultiplier: Record<DensityKey, number> = {
  compact: 0.86,
  comfortable: 1,
  airy: 1.18,
};

const cornerRadiusScale: Record<
  CornerStyleKey,
  { sm: number; md: number; lg: number; pill: number }
> = {
  square: { sm: 0, md: 0, lg: 0, pill: 3 },
  sharp: { sm: 4, md: 6, lg: 9, pill: 6 },
  balanced: { sm: 8, md: 12, lg: 18, pill: 999 },
  rounded: { sm: 12, md: 18, lg: 26, pill: 999 },
};

const fontFamilies: ThemeFontFamilies = {
  display: Platform.select({
    ios: "Inter_700Bold",
    android: "Inter_700Bold",
    default: "Inter_700Bold",
  }) as string,
  sans: Platform.select({
    ios: "Inter_400Regular",
    android: "Inter_400Regular",
    default: "Inter_400Regular",
  }) as string,
  sansMedium: Platform.select({
    ios: "Inter_500Medium",
    android: "Inter_500Medium",
    default: "Inter_500Medium",
  }) as string,
  sansBold: Platform.select({
    ios: "Inter_700Bold",
    android: "Inter_700Bold",
    default: "Inter_700Bold",
  }) as string,
  ibm: Platform.select({
    ios: "IBM Plex Sans",
    android: "IBM Plex Sans",
    default: "IBM Plex Sans",
  }) as string,
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }) as string,
};

export const textScaleLabels: Record<TextScaleKey, string> = {
  compact: "Compact",
  comfortable: "Normal",
  large: "Large",
};

export const densityLabels: Record<DensityKey, string> = {
  compact: "Compact",
  comfortable: "Normal",
  airy: "Airy",
};

export const cornerStyleLabels: Record<CornerStyleKey, string> = {
  square: "Square",
  sharp: "Sharp",
  balanced: "Balanced",
  rounded: "Rounded",
};

export const motionPreferenceLabels: Record<MotionPreferenceKey, string> = {
  full: "Full Motion",
  reduced: "Reduced Motion",
};

// Example dates shown in the Appearance picker (and the shape each key produces app-wide).
export const dateFormatLabels: Record<DateFormatKey, string> = {
  medium: "June 11, 2026",
  weekday: "Thu, June 11, 2026",
  full: "Thursday, June 11, 2026",
};

export const defaultThemeSelection: ThemeSelection = {
  appearance: "light",
  primaryColor: DEFAULT_PRIMARY_COLOR,
  textScale: "comfortable",
  density: "comfortable",
  cornerStyle: "balanced",
  motion: "full",
  dateFormat: "weekday",
  showTooltips: true,
};

// How far the neutral ramp leans toward the selected accent's hue — a small fixed saturation (see
// tintTowardAccent). Kept low so the greys read cohesive, never coloured. Tune here; dark takes a
// touch more since the tint reads fainter on near-black.
const NEUTRAL_TINT: Record<AppearanceKey, number> = {
  light: 0.08,
  dark: 0.1,
};

export function createAppTheme(
  selection: ThemeSelection = defaultThemeSelection,
): AppTheme {
  const base =
    selection.appearance === "dark" ? BASE_DARK_PALETTE : BASE_LIGHT_PALETTE;
  const accentFamily = getAccentFamily(
    selection.primaryColor,
    selection.appearance,
  );
  // Lean the neutral surfaces + borders a hair toward the accent's hue so the greys feel cohesive
  // with whatever primary the user picked (warm accent → faintly warm greys, cool → faintly cool).
  // Pure white / near-black anchors are untouched (a tint can't survive at the lightness extremes);
  // text + semantic colours stay neutral.
  const tint = (hex: string) =>
    tintTowardAccent(
      hex,
      accentFamily.accent,
      NEUTRAL_TINT[selection.appearance],
    );
  const palette: ThemePalette = {
    ...base,
    background: tint(base.background),
    backgroundMuted: tint(base.backgroundMuted),
    surface: tint(base.surface),
    surfaceMuted: tint(base.surfaceMuted),
    surfaceSunken: tint(base.surfaceSunken),
    surfaceRaised: tint(base.surfaceRaised),
    border: tint(base.border),
    borderStrong: tint(base.borderStrong),
    inputBackground: tint(base.inputBackground),
    ...accentFamily,
  };
  const density = densityMultiplier[selection.density];
  const textScale = textScaleMultiplier[selection.textScale];
  const cornerRadius = cornerRadiusScale[selection.cornerStyle];
  const motionEnabled = selection.motion === "full";

  const scaleSpace = (value: number) => Math.round(value * density);
  const scaleType = (value: number) => Math.round(value * textScale);

  return {
    selection,
    appearance: palette.appearance,
    showTooltips: selection.showTooltips,
    colors: palette,
    fonts: fontFamilies,
    motion: {
      preference: selection.motion,
      enabled: motionEnabled,
      duration: {
        fast: motionEnabled ? 110 : 0,
        normal: motionEnabled ? 180 : 0,
        slow: motionEnabled ? 260 : 0,
      },
      delay: {
        // Tightened for snappier overlay open/close (the overlay backdrop-leads-content
        // sequencing in useOverlayPresence is the only consumer). Still monotonic so the
        // "backdrop leads a beat" hierarchy reads, just quicker.
        xs: motionEnabled ? 8 : 0,
        sm: motionEnabled ? 12 : 0,
        md: motionEnabled ? 20 : 0,
      },
      spring: {
        damping: 20,
        stiffness: 280,
      },
    },
    space: {
      xxs: scaleSpace(6),
      xs: scaleSpace(8),
      sm: scaleSpace(12),
      md: scaleSpace(16),
      lg: scaleSpace(20),
      xl: scaleSpace(28),
      xxl: scaleSpace(40),
      // Unified content gutter — the horizontal inset of every form / detail / report / dashboard
      // surface. Flat list layout runs edge-to-edge, so this is 0 (sections bleed by -gutter, and
      // non-bleeding content like the reports screen carries no stray inset). Kept as a token so the
      // many `theme.space.gutter` references have one knob.
      gutter: 0,
      // Between-sections gap — 0 so flat sections stack flush into one continuous list.
      sectionGap: 0,
    },
    radius: {
      sm: cornerRadius.sm,
      md: cornerRadius.md,
      lg: cornerRadius.lg,
      pill: cornerRadius.pill,
    },
    borderWidth: {
      hairline: 1,
      sm: 1,
      md: 2,
    },
    type: {
      eyebrow: scaleType(12),
      caption: scaleType(13),
      body: scaleType(16),
      label: scaleType(15),
      sectionTitle: scaleType(19),
      title: scaleType(26),
      hero: scaleType(34),
      bodyLineHeight: scaleType(24),
      titleLineHeight: scaleType(32),
      heroLineHeight: scaleType(40),
    },
    shadow: {
      card: {
        shadowColor: palette.appearance === "dark" ? "#000000" : "#152033",
        shadowOpacity: palette.appearance === "dark" ? 0.22 : 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        // elevation kept only for legacy `...theme.shadow.card` spreads. Native consumers now read
        // `.boxShadow` directly (defined on BOTH platforms below) so a card's shadow is painted into
        // the view instead of an Android elevation shadow that reprojects every frame when the card
        // rides a translating scene (the 120Hz slide-jank fix).
        elevation: 4,
        boxShadow:
          palette.appearance === "dark"
            ? "0px 12px 28px rgba(0, 0, 0, 0.45), 0px 2px 8px rgba(0, 0, 0, 0.35)"
            : "0px 10px 24px rgba(21, 32, 51, 0.12), 0px 2px 6px rgba(21, 32, 51, 0.08)",
      },
      button: {
        shadowColor: palette.appearance === "dark" ? "#000000" : "#142031",
        shadowOpacity: palette.appearance === "dark" ? 0.12 : 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
        boxShadow:
          Platform.OS === "web"
            ? palette.appearance === "dark"
              ? "0px 2px 6px rgba(0, 0, 0, 0.30)"
              : "0px 2px 4px rgba(20, 32, 49, 0.10)"
            : undefined,
      },
      focus: {
        shadowColor: palette.focusRing,
        shadowOpacity: palette.appearance === "dark" ? 0.18 : 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 1,
      },
      // boxShadow on both platforms, NO elevation — for every floating overlay (see the type block).
      overlay: {
        boxShadow:
          palette.appearance === "dark"
            ? "0px 14px 36px rgba(0, 0, 0, 0.55)"
            : "0px 12px 32px rgba(21, 32, 51, 0.18)",
      },
    },
  };
}

export const theme = createAppTheme();
