import { memo } from "react";
import { View } from "react-native";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { SegmentedButtons } from "@spatch-kit/ui/primitives/SegmentedButtons";

type SegmentedOption = {
  label: string;
  value: string;
};

type SegmentedFieldProps = {
  caption?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  layout?: "fill" | "scroll";
  label?: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  size?: "md" | "sm";
  value: string;
};

// Memoized: an unchanged segmented control shouldn't re-render on every keystroke in a sibling field
// (the fields section rebuilds each keystroke). Requires a stable onChange from the call site.
export const SegmentedField = memo(SegmentedFieldComponent);

function SegmentedFieldComponent({
  caption,
  disabled = false,
  errorMessage,
  layout = "fill",
  label,
  onChange,
  options,
  size = "md",
  value,
}: SegmentedFieldProps) {
  return (
    <View className="gap-app-xs">
      {label ? (
        <AppText
          color={disabled ? "inputPlaceholder" : "mutedText"}
          variant="caption"
        >
          {label}
        </AppText>
      ) : null}
      <SegmentedButtons
        accessibilityLabel={label}
        disabled={disabled}
        layout={layout}
        onChange={onChange}
        options={options}
        selectedValue={value}
        size={size}
      />
      {errorMessage ? (
        <AppText color="danger" variant="caption">
          {errorMessage}
        </AppText>
      ) : caption ? (
        <AppText variant="caption">{caption}</AppText>
      ) : null}
    </View>
  );
}
