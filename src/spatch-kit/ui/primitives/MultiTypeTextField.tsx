import { type ComponentProps } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { TextField } from "@spatch-kit/ui/primitives/TextField";

// How the shared value input behaves for one type. Each type carries its OWN field config, so the
// component switches the whole input (label, value, formatting) when the type changes — the caller
// declares each type once instead of branching on the active type at the call site.
type MultiTypeFieldConfig = Pick<
  ComponentProps<typeof TextField>,
  | "label"
  | "caption"
  | "value"
  | "onChangeText"
  | "keyboardType"
  | "fieldValueBehavior"
  | "decimals"
  | "placeholder"
>;

export type MultiTypeOption = {
  value: string; // the type key
  label: string; // the button label
  field: MultiTypeFieldConfig;
};

type MultiTypeTextFieldProps = {
  types: MultiTypeOption[];
  selectedType: string;
  onTypeChange: (value: string) => void;
};

// A TextField fused to a segmented TYPE selector directly beneath it, so ONE value input can mean
// different things (a %, a flat $, a round-to target…) with the buttons switching
// which. The field's bottom corners go square and the button row butts flush against it, sharing the
// field's bottom border as the seam and rounding only its OUTER bottom corners (via overflow-hidden)
// — so the two read as a single uniform control. The buttons sit a touch thinner than a normal
// button. The active type's config drives the input; its caption renders below the whole control.
export function MultiTypeTextField({
  types,
  selectedType,
  onTypeChange,
}: MultiTypeTextFieldProps) {
  const theme = useTheme();
  const active = types.find((t) => t.value === selectedType) ?? types[0];
  const cfg = active?.field;
  // Only fuse the button row when there's an actual choice to make.
  const attached = types.length > 1;
  // Square off the field's bottom corners (resting border + focus overlay) so the row sits flush.
  const flatBottom = { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 };

  return (
    <View className="gap-1">
      <View>
        <TextField
          label={cfg?.label}
          value={cfg?.value ?? ""}
          onChangeText={cfg?.onChangeText}
          keyboardType={cfg?.keyboardType}
          fieldValueBehavior={cfg?.fieldValueBehavior}
          decimals={cfg?.decimals}
          placeholder={cfg?.placeholder}
          shellStyle={attached ? flatBottom : undefined}
          focusOverlayStyle={attached ? flatBottom : undefined}
        />
        {attached ? (
          <View
            className="flex-row overflow-hidden"
            style={{
              borderColor: theme.colors.borderStrong,
              borderWidth: theme.borderWidth.sm,
              borderTopWidth: 0, // the field's bottom border is the divider — no double line.
              borderBottomLeftRadius: theme.radius.sm,
              borderBottomRightRadius: theme.radius.sm,
            }}
          >
            {types.map((t, index) => {
              const isSelected = t.value === selectedType;
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onTypeChange(t.value)}
                  className={[
                    "min-h-[36px] flex-1 flex-row items-center justify-center px-app-sm py-app-xs active:opacity-90",
                    index > 0 ? "border-l border-border-strong" : "",
                    isSelected ? "bg-accent" : "bg-surface",
                  ].join(" ")}
                >
                  <AppText
                    className="text-center"
                    color={isSelected ? "accentContrast" : "accent"}
                    numberOfLines={1}
                    variant="label"
                  >
                    {t.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {cfg?.caption ? (
        <AppText className="px-1" variant="caption">
          {cfg.caption}
        </AppText>
      ) : null}
    </View>
  );
}
