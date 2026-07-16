import { memo, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { PickerFieldShell } from "@spatch-kit/ui/primitives/PickerFieldShell";
import { SelectPopup, type SelectOption } from "@spatch-kit/ui/primitives/SelectPopup";

type SelectFieldProps = {
  // When true, the popup shows a "Custom…" row (above "Clear selection") that
  // reveals an inline text field for typing a value not in `options` (free text).
  allowCustomValue?: boolean;
  caption?: string;
  clearable?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  label?: string;
  // Optional glyph shown beside the label (forwarded to PickerFieldShell), like DateField's.
  leadingIcon?: IconName;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
};

// Memoized so a keystroke in a sibling text field (which re-renders the whole fields section) doesn't
// re-render every unchanged Select; the call site passes a stable onChange for the shallow compare to bite.
export const SelectField = memo(SelectFieldComponent);

function SelectFieldComponent({
  allowCustomValue = false,
  caption,
  clearable = true,
  disabled = false,
  errorMessage,
  label,
  leadingIcon,
  onChange,
  options,
  placeholder,
  value,
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<View | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  // A value present but not in `options` is a custom (free-text) value: the trigger shows it verbatim.
  const isCustomValue = allowCustomValue && !!value && !selectedOption;
  const triggerLabel = selectedOption?.label ?? (isCustomValue ? value : null);

  return (
    <>
      <View ref={triggerRef}>
        <PickerFieldShell
          caption={caption}
          disabled={disabled}
          errorMessage={errorMessage}
          hasValue={Boolean(triggerLabel)}
          label={label}
          leadingIcon={leadingIcon}
          onPress={() => setIsOpen((current) => !current)}
          trailingIcon={isOpen ? "chevronUp" : "chevronDown"}
          value={triggerLabel ?? placeholder ?? `Select ${label ?? "option"}`}
        />
      </View>

      <SelectPopup
        allowCustomValue={allowCustomValue}
        anchorRef={triggerRef}
        clearable={clearable}
        onChange={onChange}
        onClose={() => setIsOpen(false)}
        options={options}
        value={value}
        visible={isOpen}
      />
    </>
  );
}
