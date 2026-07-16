import { type Ref } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { FloatingFieldShell } from "@spatch-kit/ui/primitives/FloatingFieldShell";

type PickerFieldShellProps = {
  caption?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  label?: string;
  // Optional glyph shown next to the LABEL (top row), left-aligned with it — e.g. a calendar for
  // dates or the entity-type icon for relations. It belongs with the label, not the value.
  leadingIcon?: IconName;
  onPress?: () => void;
  triggerRef?: Ref<View>;
  // Trailing glyph (the chevron) — centered vertically across the FULL control height.
  trailingIcon?: IconName;
  // The selected value's text, or the placeholder when nothing is chosen.
  value: string;
  // true → a real selection (full text colour); false → placeholder (muted), like TextField.
  hasValue: boolean;
};

// A pressable field trigger that matches a filled single-line TextField: the field/type label on
// top (with its icon beside it, left-aligned), the value/placeholder on the line below, the same
// compact height, border, padding and left alignment, and the chevron centered down the side.
// Used by SelectField, DateField and the EntitySelector's empty trigger so every picker matches a
// text field (and each other).
export function PickerFieldShell({
  caption,
  disabled = false,
  errorMessage,
  label,
  leadingIcon,
  onPress,
  triggerRef,
  trailingIcon,
  value,
  hasValue,
}: PickerFieldShellProps) {
  const theme = useTheme();
  const chevronSize = theme.type.caption + 5;
  const labelIconSize = theme.type.caption + 2;
  // Mirror TextField's single-line height so every field lines up (see TextField.tsx).
  const lane = theme.type.bodyLineHeight + theme.space.xxs / 2;
  const bottom = theme.space.xs - theme.space.xxs / 2;
  const minHeight = lane + theme.type.bodyLineHeight + bottom;
  const trailingGutter = trailingIcon ? chevronSize + theme.space.md : 0;
  // Accessible name: only fold in `value` when it's a real selection (`hasValue`). With no selection,
  // `value` is placeholder text, so announce the field's label alone (or the placeholder if unlabeled)
  // — never "Label: Select…", which would read as a chosen value.
  const accessibleName = hasValue
    ? `${label ? `${label}: ` : ""}${value}`
    : (label ?? value);

  return (
    <FloatingFieldShell
      caption={caption}
      disabled={disabled}
      errorMessage={errorMessage}
    >
      {() => (
        <Pressable
          ref={triggerRef}
          accessibilityLabel={accessibleName}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          className={[
            "rounded-app-sm border bg-input-background px-app-xs",
            disabled ? "opacity-50" : "active:opacity-90",
          ].join(" ")}
          style={{
            borderColor: theme.colors.borderStrong,
            borderWidth: theme.borderWidth.sm,
            justifyContent: "center",
            minHeight,
            paddingBottom: bottom,
            paddingTop: bottom,
          }}
        >
          <View
            className="gap-app-xxs"
            style={{ paddingRight: trailingGutter }}
          >
            {label ? (
              // Label row: the field/type name + its icon, left-aligned — the field's identity.
              <View className="flex-row items-center gap-app-xs">
                {leadingIcon ? (
                  <AppIcon name={leadingIcon} size={labelIconSize} />
                ) : null}
                <AppText
                  className="flex-1"
                  color="mutedText"
                  numberOfLines={1}
                  variant="caption"
                >
                  {label}
                </AppText>
              </View>
            ) : null}

            {/* Value row: left-aligned with the label/icon above it. */}
            <AppText
              color={hasValue ? "text" : "mutedText"}
              numberOfLines={1}
              variant="body"
            >
              {value}
            </AppText>
          </View>

          {trailingIcon ? (
            <View
              pointerEvents="none"
              style={{
                bottom: 0,
                justifyContent: "center",
                position: "absolute",
                right: theme.space.sm,
                top: 0,
              }}
            >
              <AppIcon name={trailingIcon} size={chevronSize} />
            </View>
          ) : null}
        </Pressable>
      )}
    </FloatingFieldShell>
  );
}
