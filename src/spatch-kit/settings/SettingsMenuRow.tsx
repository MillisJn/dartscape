import { memo } from "react";
import { View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { PressableTint } from "@spatch-kit/ui/primitives/pressFeedback";

export type SettingsMenuRowProps = {
  icon: IconName;
  onPress: () => void;
  title: string;
  // Optional second line, e.g. "Owner access required" under a gated row.
  subtitle?: string;
  // Disabled rows are dimmed and ignore taps (used for owner-gated entries shown to
  // non-owners — discoverable, but not actionable).
  disabled?: boolean;
  // Highlighted as the active row (the desktop master-detail menu).
  selected?: boolean;
  // "danger" tints the icon and label red (e.g. the Sign Out row).
  tone?: "default" | "danger";
};

// A plain settings row: a bare black icon + label, no icon background, no chevron, and no
// divider line. Sections are separated by the group headers in the menu, not per-row rules.
// Memoized: menus render many of these and re-render on unrelated parent updates; a row only needs to
// re-paint when its own props change (pass a stable `onPress` to get the full benefit).
export const SettingsMenuRow = memo(function SettingsMenuRow({
  icon,
  onPress,
  title,
  subtitle,
  disabled = false,
  selected = false,
  tone = "default",
}: SettingsMenuRowProps) {
  const theme = useTheme();
  const iconColor = disabled
    ? theme.colors.mutedText
    : tone === "danger"
      ? theme.colors.danger
      : theme.colors.text;

  return (
    <PressableTint
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      // Background via className (not inline) so the web hover wash can apply and fade — inline bg
      // would out-specify the `hover:` class. Selected stays the accent wash; otherwise a neutral
      // hover on web that PressableTint eases in/out.
      className={
        selected ? "bg-accent-muted" : disabled ? "" : "hover:bg-background-muted"
      }
      disabled={disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View
        className="flex-row items-center gap-app-md pl-app-lg pr-app-md"
        style={{ paddingVertical: 12 }}
      >
        <AppIcon alignText color={iconColor} name={icon} size={20} />
        <View className="flex-1 gap-app-xxs">
          <AppText color={tone === "danger" ? "danger" : undefined} variant="label">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" style={{ color: theme.colors.mutedText }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
    </PressableTint>
  );
});
