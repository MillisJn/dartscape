// Shared color palette + hex normalization for the `color` field format. Pure
// logic only (no React Native imports) so it stays unit-testable under tsx/node.

// Default swatch set for the color picker: 19 distinct hues organized around the
// color wheel (white → warm → cool → neutral) that read well over both standard
// and satellite map tiles. The picker renders a leading "no color" cell before
// these, making an even 20-cell (5×4) grid. All lowercase #rrggbb so they compare
// equal to normalizeHexColor output.
export const DEFAULT_COLOR_PALETTE: readonly string[] = [
  "#ffffff", // white
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate
];

const SHORT_HEX = /^#?([0-9a-f]{3})$/i;
const LONG_HEX = /^#?([0-9a-f]{6})$/i;

// Normalize user/stored input to a canonical lowercase `#rrggbb` string. Accepts
// 3- or 6-digit hex with or without a leading `#`; expands shorthand (`#abc` ->
// `#aabbcc`). Returns null for anything unparseable (including empty), which the
// callers treat as "no color" (map falls back to its default feature color).
export function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();

  const shortMatch = SHORT_HEX.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const longMatch = LONG_HEX.exec(trimmed);
  if (longMatch) {
    return `#${longMatch[1]}`.toLowerCase();
  }

  return null;
}
