/**
 * The Game Screen's fixed palette — ported verbatim from Dartscape OG Android's default
 * color scheme (MyColors.java / colors.xml). Deliberately NOT derived from
 * @spatch-kit/theme: the game screen's look is meant to match the original almost
 * exactly, independent of the user's light/dark/accent selection elsewhere in the app.
 */

export const PALETTE = {
  screenBackground: "#005503",
  titleBar: "#002701",
  header: "#003E02",
  control: "#003E02",
  text: "#FFFFFF",
  textShadow: "#000000",
  divider: "#CCCCCC",
  /** The active player's column fill — screenBackground blended toward white. */
  activeHighlight: "#1A6B1C",
  single: "#44FF44",
  double: "#66AAFF",
  treble: "#FFBB00",
  red: "#FF0000",
  redLight: "#FF8888",
  controlPadding: 6,
} as const;

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear RGB blend from `from` toward `to`, ratio 0 = `from`, 1 = `to`. Mirrors
 * Android's ColorUtils.blendARGB (alpha untouched — every palette color is opaque). */
export function blendHex(from: string, to: string, ratio: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex(a.r + (b.r - a.r) * ratio, a.g + (b.g - a.g) * ratio, a.b + (b.b - a.b) * ratio);
}

/** Disabled/inactive text — the original blends 50% toward gray, then halves alpha.
 * We fold both steps into a single flat opaque color against the header background so
 * it stays crisp without needing an rgba composite. */
export function disabledText(): string {
  return blendHex(blendHex(PALETTE.text, "#808080", 0.5), PALETTE.header, 0.5);
}
