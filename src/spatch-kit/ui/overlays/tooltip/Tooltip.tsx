import { useRef, type PropsWithChildren } from "react";
import {
  Platform,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";

import { TooltipBubble } from "./TooltipBubble";
import { useTooltipState } from "./useTooltipState";

// Wrap any element to give it a hover tooltip on web without touching the child. Prefer <IconButton>
// for plain icon buttons; reach for this when the trigger keeps its own Pressable — a notification
// bell with a badge child, a toggle, a floating action button.
//
// We wrap in a thin View (rather than cloning the child to inject hover props) because children vary
// and several already own a ref for menu anchoring — cloneElement would fight for it. The wrapper
// shrink-wraps its child by default (alignSelf: flex-start) so it doesn't stretch a flex cell;
// override via `style` when the caller needs different alignment. Hover comes from web pointer events
// (react-native-web forwards onMouseEnter/onMouseLeave on a View at runtime; RN's types omit them,
// hence the cast). On native it's a pure passthrough — the child's accessibilityLabel covers a11y.
export function Tooltip({
  label,
  placement,
  disabled,
  style,
  children,
}: PropsWithChildren<{
  label: string;
  placement?: "top" | "bottom";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const theme = useTheme();
  const anchorRef = useRef<View | null>(null);
  const enabled =
    Platform.OS === "web" && theme.showTooltips && !disabled && !!label;
  const { visible, onHoverIn, onHoverOut } = useTooltipState(enabled);

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const webHoverProps = {
    onMouseEnter: onHoverIn,
    onMouseLeave: onHoverOut,
  } as unknown as ViewProps;

  return (
    <View ref={anchorRef} style={[{ alignSelf: "flex-start" }, style]} {...webHoverProps}>
      {children}
      <TooltipBubble
        anchorRef={anchorRef}
        label={label}
        placement={placement}
        visible={visible}
      />
    </View>
  );
}
