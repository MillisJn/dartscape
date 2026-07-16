import type { PropsWithChildren, Ref } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@spatch-kit/theme/provider";

export const BOTTOM_ACTION_BAR_KEYBOARD_OFFSET_RATIO = 3.05;

type BottomActionBarProps = PropsWithChildren<{
  className?: string;
  containerRef?: Ref<View>;
  floating?: boolean;
  keyboardOffset?: number;
  // Whether this bar is the true bottom-most element on screen (nothing else — like a
  // BottomNavBar — sits below it) and so must itself clear the Android gesture/nav bar. Defaults
  // to `floating`, since a floating bar is always pinned to the raw screen edge (`bottom: 0`); a
  // non-floating bar that stacks above something else (e.g. SetupScreen's BottomNavBar) should
  // leave the inset to whatever IS last, or the two would double up on clearance.
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function BottomActionBar({
  children,
  className,
  containerRef,
  floating = true,
  keyboardOffset = 0,
  safeBottom = floating,
  style,
}: BottomActionBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = theme.space.sm + (safeBottom ? insets.bottom : 0);

  return (
    <View
      ref={containerRef}
      className={[
        floating
          ? "absolute inset-x-0 bottom-0 border-t border-border bg-surface px-app-md py-app-sm"
          : "border-t border-border bg-surface px-app-md py-app-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={[
        floating
          ? { bottom: keyboardOffset }
          : keyboardOffset > 0
            ? { marginBottom: keyboardOffset }
            : null,
        // boxShadow on BOTH platforms (RN 0.85 renders it natively): painted into the view, so it
        // never reprojects per-frame on Android the way `elevation` did when this bar rides a
        // translating record/creator scene — the overdraw/transition-jank fix.
        floating ? { boxShadow: "0px -8px 18px rgba(44, 34, 25, 0.08)" } : null,
        // Overrides the className's paddingBottom (py-app-sm) with the same base plus, when this
        // bar owns the screen's true bottom edge, the safe-area inset — otherwise Android's
        // edge-to-edge gesture bar sits on top of the buttons.
        { paddingBottom: bottomPadding },
        style,
      ]}
    >
      <View className="flex-row gap-app-sm">{children}</View>
    </View>
  );
}
