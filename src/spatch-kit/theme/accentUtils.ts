// Derives the accent-color family (accent, muted, contrast, focus ring/glow) from
// a single user-picked primary color + the active appearance. This is the ONLY
// place accent colors are computed — keep all accent math here so it can't drift
// back into the scattered per-preset palettes this replaced. Pure logic only (no
// React Native imports) so it stays unit-testable under tsx/node.

import { normalizeHexColor } from "@spatch-kit/theme/colorPalette";

export type AppearanceKey = "light" | "dark";

export type AccentFamily = {
  accent: string;
  accentMuted: string;
  accentContrast: string;
  focusRing: string;
  focusGlow: string;
};

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

// YIQ perceived brightness (0–255) — the classic heuristic for choosing black vs
// white text. Simpler and more forgiving than WCAG max-contrast, which would flip
// the default green button to black text and change the established look.
export function getPerceivedBrightness(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Text/icon color that sits ON the accent. Saturated/dark accents (brightness
// < 128) get white; genuinely light accents (pale cyan, yellow, etc.) get
// near-black. The default green (#2f8f4e ≈ 107) stays white, as it was.
export function getAccentContrast(hex: string): string {
  return getPerceivedBrightness(hex) >= 128 ? "#0f172a" : "#ffffff";
}

// Tinted accent background: blend toward white in light mode, toward black in
// dark mode. Mirrors the hand-tuned `accentMuted` values of the old presets.
export function getAccentMuted(hex: string, appearance: AppearanceKey): string {
  const { r, g, b } = hexToRgb(hex);
  const [tr, tg, tb] = appearance === "light" ? [255, 255, 255] : [0, 0, 0];
  const t = appearance === "light" ? 0.82 : 0.7;
  return rgbToHex(r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t);
}

type Hsl = { h: number; s: number; l: number };

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return { h: h / 6, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: hue2rgb(h + 1 / 3) * 255,
    g: hue2rgb(h) * 255,
    b: hue2rgb(h - 1 / 3) * 255,
  };
}

// Nudge a NEUTRAL toward the accent's HUE with a small, FIXED saturation — independent of how
// saturated the accent itself is, so a hot yellow tints a gray no more than a soft blue (never
// "muddy"). Keeps the neutral's own lightness, so pure white / near-black stay put (a tint can't
// survive at L=1 or L=0). `strength` is that small tint saturation, e.g. 0.05. Because it rebuilds
// from (accent hue, strength, neutral lightness), it also neutralizes any hue baked into the input.
export function tintTowardAccent(
  neutralHex: string,
  accentHex: string,
  strength: number,
): string {
  const { h } = rgbToHsl(hexToRgb(accentHex));
  const { l } = rgbToHsl(hexToRgb(neutralHex));
  const { r, g, b } = hslToRgb({ h, s: strength, l });
  return rgbToHex(r, g, b);
}

function getFocusGlow(hex: string, appearance: AppearanceKey): string {
  const { r, g, b } = hexToRgb(hex);
  const alpha = appearance === "light" ? 0.16 : 0.2;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Single entry point: resolve every accent-derived token from one primary color.
// Falls back to a safe value if the input somehow isn't a valid hex (callers
// should pre-validate, but this keeps the theme from ever rendering undefined).
export function getAccentFamily(
  primaryColor: string,
  appearance: AppearanceKey,
): AccentFamily {
  const accent = normalizeHexColor(primaryColor) ?? "#2f8f4e";
  return {
    accent,
    accentMuted: getAccentMuted(accent, appearance),
    accentContrast: getAccentContrast(accent),
    focusRing: accent,
    focusGlow: getFocusGlow(accent, appearance),
  };
}
