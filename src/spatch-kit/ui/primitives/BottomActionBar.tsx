import type { PropsWithChildren, Ref } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export const BOTTOM_ACTION_BAR_KEYBOARD_OFFSET_RATIO = 3.05;

type BottomActionBarProps = PropsWithChildren<{
  className?: string;
  containerRef?: Ref<View>;
  floating?: boolean;
  keyboardOffset?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function BottomActionBar({
  children,
  className,
  containerRef,
  floating = true,
  keyboardOffset = 0,
  style,
}: BottomActionBarProps) {
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
        style,
      ]}
    >
      <View className="flex-row gap-app-sm">{children}</View>
    </View>
  );
}
