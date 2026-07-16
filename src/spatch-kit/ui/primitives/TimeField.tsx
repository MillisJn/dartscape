import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import {
  parseStoredDateTime,
  toStoredDateTime,
} from "@spatch-kit/utils/scheduledDateTime";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import { PickerFieldShell } from "@spatch-kit/ui/primitives/PickerFieldShell";
import { TimeInput } from "@spatch-kit/ui/primitives/TimeInput";
import { formatTime } from "@spatch-kit/ui/time/timeModel";

type TimeFieldProps = {
  // The calendar day the time is attached to (used when the value is empty). The
  // field only edits the time-of-day; the stored value keeps this day.
  baseDate: Date;
  caption?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  label?: string;
  onChange: (value: string) => void;
  // Stored datetime ("YYYY-MM-DDTHH:mm:00"), or "" for unset.
  value: string;
};

const DEFAULT_HOUR_24 = 9;

// A time-of-day picker. On touch the inner TimeInput is the spinner; on web it's a typeable field +
// dropdown — same props, chosen by the platform. No redundant preview text: the editor is the UI.
export function TimeField({
  baseDate,
  caption,
  disabled = false,
  errorMessage,
  label,
  onChange,
  value,
}: TimeFieldProps) {
  const parsedValue = useMemo(() => parseStoredDateTime(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [draftHour24, setDraftHour24] = useState(
    parsedValue?.getHours() ?? DEFAULT_HOUR_24,
  );
  const [draftMinute, setDraftMinute] = useState(
    parsedValue?.getMinutes() ?? 0,
  );

  const displayValue = parsedValue
    ? formatTime(parsedValue.getHours(), parsedValue.getMinutes())
    : null;

  // Seed positions read by the editor on open. parsedValue is stable while the sheet is open.
  const seedHour24 = parsedValue?.getHours() ?? DEFAULT_HOUR_24;
  const seedMinute = parsedValue?.getMinutes() ?? 0;

  function openPicker() {
    setDraftHour24(seedHour24);
    setDraftMinute(seedMinute);
    setIsOpen(true);
  }

  const handleTimeChange = useCallback((hour24: number, minute: number) => {
    setDraftHour24(hour24);
    setDraftMinute(minute);
  }, []);

  function applySelection() {
    const next = new Date(parsedValue ?? baseDate);
    next.setHours(draftHour24, draftMinute, 0, 0);
    onChange(toStoredDateTime(next));
    setIsOpen(false);
  }

  return (
    <>
      <PickerFieldShell
        caption={caption}
        disabled={disabled}
        errorMessage={errorMessage}
        hasValue={Boolean(displayValue)}
        label={label}
        leadingIcon="clock"
        onPress={openPicker}
        trailingIcon={isOpen ? "chevronUp" : "chevronDown"}
        value={displayValue ?? "Select time"}
      />

      <AppModal
        centered
        headerLeadingAccessory={<AppIcon name="clock" />}
        footer={
          <View className="flex-row gap-app-sm">
            <Button
              className="flex-1"
              onPress={() => setIsOpen(false)}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onPress={applySelection}
              variant="primary"
            >
              Apply
            </Button>
          </View>
        }
        manageOverlayDismissal={false}
        onClose={() => setIsOpen(false)}
        title={label ?? "Select time"}
        visible={isOpen}
      >
        <View className="items-center gap-app-md bg-surface-raised p-app-md">
          <TimeInput
            initialHour24={seedHour24}
            initialMinute={seedMinute}
            onChange={handleTimeChange}
          />
        </View>
      </AppModal>
    </>
  );
}
