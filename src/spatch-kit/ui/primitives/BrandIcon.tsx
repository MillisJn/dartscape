import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@spatch-kit/theme/provider";

import { BRAND_GLYPHS, type BrandKey } from "./brandGlyphs";

export type { BrandKey };

type BrandIconProps = {
  name: BrandKey;
  size?: number;
  // Glyph fill. Omitted → the official brand color, with a contrast guard that swaps in the theme
  // text color when the brand hue is too low-contrast against the current background (so pure-black
  // marks like X / TikTok, or PayPal's navy, stay visible in dark mode). Pass an explicit color to
  // force it (e.g. the theme text color for a fully monochrome row).
  color?: ColorValue;
};

// #rrggbb / #rgb → [r,g,b] 0–255, or null if it isn't a plain hex (e.g. an rgba()/named color).
function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// WCAG relative luminance of an sRGB color.
function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

// Below this ratio the brand hue is effectively invisible against the background, so we fall back to
// the theme text color (which contrasts with the background in either theme). Kept deliberately low
// (favor keeping the brand color) so only truly unreadable marks flip — black X/TikTok and navy
// PayPal on a dark theme, lime Nextdoor on a light one — while e.g. Cash App keeps its green.
const MIN_CONTRAST = 1.8;

// A single-path brand mark (PayPal, Cash App, Facebook, …) rendered from the committed brandGlyphs
// data (generated from simple-icons). Companion to AppIcon for the few brand logos Lucide lacks;
// callers fall back to AppIcon for unknown/absent brands.
export function BrandIcon({ name, size, color }: BrandIconProps) {
  const theme = useTheme();
  const glyph = BRAND_GLYPHS[name];
  const resolvedSize = size ?? theme.type.label + 2;

  let fill: ColorValue;
  if (color !== undefined) {
    fill = color;
  } else {
    const brandRgb = parseHex(glyph.hex);
    const bgRgb = parseHex(String(theme.colors.background));
    // Use the brand color unless it can't be seen against the background — then the theme text color.
    fill =
      brandRgb && bgRgb && contrastRatio(brandRgb, bgRgb) < MIN_CONTRAST
        ? (theme.colors.text as ColorValue)
        : (glyph.hex as ColorValue);
  }

  return (
    <Svg width={resolvedSize} height={resolvedSize} viewBox="0 0 24 24">
      <Path d={glyph.path} fill={fill} />
    </Svg>
  );
}
