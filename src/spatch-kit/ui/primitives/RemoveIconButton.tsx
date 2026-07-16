import { type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { IconButton } from "@spatch-kit/ui/primitives/IconButton";

// A bare X button for removing/dismissing a row or item — same plain, borderless look as the close
// (X) at the top of a modal. Sits in a 44×44 touch target so it lines up with adjacent fields and
// stays comfortably tappable; the glyph itself is `size`. Use anywhere a small "remove this" needs
// to sit inline (a list row, beside a field) rather than a full-width "Remove" button.
//
// A thin wrapper over IconButton, so it inherits the hover tooltip, the accessibility label, and the
// hover/press micro-animation for free.
export function RemoveIconButton({
  onPress,
  accessibilityLabel,
  disabled = false,
  size = 22,
  style,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <IconButton
      color={theme.colors.text}
      disabled={disabled}
      icon="close"
      label={accessibilityLabel}
      onPress={onPress}
      size={size}
      style={style}
    />
  );
}
