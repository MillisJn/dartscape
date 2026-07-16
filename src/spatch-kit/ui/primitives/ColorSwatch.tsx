import { View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { normalizeHexColor } from "@spatch-kit/theme/colorPalette";

type ColorSwatchProps = {
  // Raw stored value (hex or empty). Normalized internally; an unparseable/empty
  // value renders as a muted "no color" ring rather than a filled dot.
  color: string | null | undefined;
  size?: number;
};

// Small color dot reused by the picker trigger, the preset grid, and the display
// (record/list) sites so swatch styling lives in one place.
export function ColorSwatch({ color, size = 16 }: ColorSwatchProps) {
  const theme = useTheme();
  const normalized = normalizeHexColor(color);

  return (
    <View
      style={{
        backgroundColor: normalized ?? "transparent",
        // Always a neutral outline (not the fill color) so light/white swatches
        // stay visible against a light surface instead of blending in.
        borderColor: theme.colors.borderStrong,
        borderRadius: size / 2,
        borderWidth: theme.borderWidth.sm,
        height: size,
        width: size,
      }}
    />
  );
}
