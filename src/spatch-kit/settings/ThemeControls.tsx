import { Pressable, View } from "react-native";

import {
  cornerStyleLabels,
  type AppearanceKey,
  type CornerStyleKey,
} from "@spatch-kit/theme/theme";
import { useTheme } from "@spatch-kit/theme/provider";
import { SegmentedField } from "@spatch-kit/ui/primitives/SegmentedField";

export function AppearancePicker({
  onChange,
  value,
}: {
  onChange: (value: AppearanceKey) => void;
  value: AppearanceKey;
}) {
  return (
    <SegmentedField
      label="Appearance"
      onChange={(v) => onChange(v as AppearanceKey)}
      options={[
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ]}
      value={value}
    />
  );
}

// Preview radii on a 38×22 rect — distinct shapes: sharp corner / slight / noticeably round / pill
const cornerPreviewRadius: Record<CornerStyleKey, number> = {
  square: 0,
  sharp: 3,
  balanced: 7,
  rounded: 11,
};

const cornerStyleKeys: CornerStyleKey[] = ["square", "sharp", "balanced", "rounded"];

export function CornerStylePicker({
  onChange,
  value,
}: {
  onChange: (value: CornerStyleKey) => void;
  value: CornerStyleKey;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.borderStrong,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        flexDirection: "row",
        overflow: "hidden",
        width: "100%",
      }}
    >
      {cornerStyleKeys.map((key, index) => {
        const isSelected = key === value;
        return (
          <Pressable
            key={key}
            accessibilityLabel={cornerStyleLabels[key]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(key)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: isSelected
                ? theme.colors.accentMuted
                : pressed
                  ? theme.colors.surfaceMuted
                  : "transparent",
              borderLeftColor: theme.colors.borderStrong,
              borderLeftWidth: index === 0 ? 0 : 1,
              flex: 1,
              justifyContent: "center",
              minHeight: 50,
            })}
          >
            <View
              style={{
                borderColor: isSelected
                  ? theme.colors.accent
                  : theme.colors.mutedText,
                borderRadius: cornerPreviewRadius[key],
                borderWidth: 2,
                height: 22,
                width: 38,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export {
  accentSwatchesFor,
  cornerStyleLabels,
  dateFormatLabels,
  densityLabels,
  motionPreferenceLabels,
  textScaleLabels,
} from "@spatch-kit/theme/theme";
export type {
  AppearanceKey,
  CornerStyleKey,
  DateFormatKey,
  DensityKey,
  MotionPreferenceKey,
  TextScaleKey,
} from "@spatch-kit/theme/theme";
