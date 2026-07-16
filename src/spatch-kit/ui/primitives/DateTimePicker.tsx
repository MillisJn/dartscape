import { memo, useMemo, useState } from "react";
import { View } from "react-native";

import {
  padScheduleNumber,
  parseStoredDateTime,
  toStoredDateTime,
} from "@spatch-kit/utils/scheduledDateTime";
import { formatAppTime, formatCompactDate } from "@spatch-kit/theme/appDateFormat";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { BaseCalendar } from "@spatch-kit/ui/primitives/BaseCalendar";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import { PickerFieldShell } from "@spatch-kit/ui/primitives/PickerFieldShell";
import { SelectField } from "@spatch-kit/ui/primitives/SelectField";
import { clockOfMinutes } from "@spatch-kit/ui/time/timeModel";
import { TIME_OPTIONS } from "@spatch-kit/ui/time/timeSelectOptions";

type DateTimePickerFormat = "date" | "datetime";

type DateTimePickerProps = {
  caption?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  format: DateTimePickerFormat;
  label?: string;
  onChange: (value: string) => void;
  value: string;
};

// TIME_OPTIONS are 15-min steps; snap an arbitrary minute-of-day (an auto-stamped timestamp can land on
// any minute) so the Time select always highlights a real option.
function snapToOption(minutesOfDay: number): number {
  const snapped = Math.round(minutesOfDay / 15) * 15;
  return Math.max(0, Math.min(24 * 60 - 15, snapped));
}

function toStoredValue(date: Date, format: DateTimePickerFormat) {
  if (format === "date") {
    return `${date.getFullYear()}-${padScheduleNumber(
      date.getMonth() + 1,
    )}-${padScheduleNumber(date.getDate())}`;
  }
  return toStoredDateTime(date);
}

function toDisplayValue(date: Date, format: DateTimePickerFormat) {
  const compactDate = formatCompactDate(date);
  return format === "date"
    ? compactDate
    : `${compactDate} • ${formatAppTime(date)}`;
}

// The plain date / date-time field: whatever month calendar the app registers into the BaseCalendar
// slot (see calendarSlot — the kit ships no concrete calendar, so an app can supply one with a
// tappable "Month Year" header, arrows, month swipe, etc.) plus, for the datetime format, a Time
// select. Deliberately minimal — no duration, no hour-view timeline, no schedule dots — because a
// plain timestamp ("completed at", a report range) is "just a date and a time". An app that needs a
// richer scheduling-window picker should build that separately rather than grow this.
// Memoized so an unchanged date field doesn't re-render on every keystroke in a sibling field. The
// call site passes a stable onChange for the shallow compare to bite.
export const DateTimePicker = memo(DateTimePickerComponent);

function DateTimePickerComponent({
  caption,
  disabled = false,
  errorMessage,
  format,
  label,
  onChange,
  value,
}: DateTimePickerProps) {
  const parsedValue = useMemo(() => parseStoredDateTime(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(parsedValue);

  // The day the time controls operate on: the chosen draft day, else the saved value, else today.
  const baseDate = draftDate ?? parsedValue ?? new Date();
  const displayValue = parsedValue ? toDisplayValue(parsedValue, format) : null;

  function openPicker() {
    setDraftDate(parseStoredDateTime(value));
    setIsOpen(true);
  }

  // Picking a day keeps the current time-of-day (from baseDate), so choosing a date doesn't reset the
  // time the user already set.
  function handleSelectDate(date: Date) {
    const next = new Date(date);
    next.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
    setDraftDate(next);
  }

  function handleSelectTime(minutesOfDay: number) {
    const clock = clockOfMinutes(minutesOfDay);
    const next = new Date(baseDate);
    next.setHours(clock.hour24, clock.minute, 0, 0);
    setDraftDate(next);
  }

  function applySelection() {
    onChange(draftDate ? toStoredValue(draftDate, format) : "");
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
        leadingIcon="calendar"
        onPress={openPicker}
        trailingIcon={isOpen ? "chevronUp" : "chevronDown"}
        value={
          displayValue ??
          `Select ${format === "date" ? "date" : "date and time"}`
        }
      />

      <AppModal
        // Same shell as the schedule picker: a full-screen sheet on phone (a capped centered panel on
        // web ≥768), so a plain date/time field opens the SAME popup — just without the hour timeline,
        // the week↔month toggle, or a duration. The month calendar (BaseCalendar slot) is the same day
        // view the schedule screen uses, and the Time select is the same control.
        centered={false}
        headerLeadingAccessory={
          <AppIcon name={format === "date" ? "calendar" : "clock"} />
        }
        manageOverlayDismissal={false}
        footer={
          <View className="flex-row gap-app-sm">
            <Button
              className="flex-1"
              onPress={() => {
                setDraftDate(null);
                onChange("");
                setIsOpen(false);
              }}
              variant="ghost"
            >
              Clear
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
        onClose={() => setIsOpen(false)}
        title={
          label ?? (format === "date" ? "Select Date" : "Select Date and Time")
        }
        visible={isOpen}
      >
        <View className="min-h-0 flex-1 bg-surface-raised">
          {/* The month calendar, centered in the available space (capped so it doesn't stretch on a
              wide sheet) — the same grid the schedule picker shows. */}
          <View className="min-h-0 flex-1 items-center justify-center p-app-md">
            <View className="w-full max-w-[520px] overflow-hidden rounded-app-lg border border-border bg-surface">
              <BaseCalendar
                onSelectDate={handleSelectDate}
                selectedDate={draftDate}
              />
            </View>
          </View>

          {/* Time control pinned at the bottom (datetime only) — the same Start/Time select control. */}
          {format === "datetime" ? (
            <View className="gap-app-sm border-t border-border bg-surface-raised p-app-md">
              <SelectField
                clearable={false}
                label="Time"
                leadingIcon="clock"
                onChange={(next) => handleSelectTime(Number(next))}
                options={TIME_OPTIONS}
                value={String(
                  snapToOption(baseDate.getHours() * 60 + baseDate.getMinutes()),
                )}
              />
              {draftDate ? (
                <AppText
                  adjustsFontSizeToFit
                  className="text-center"
                  color="text"
                  numberOfLines={1}
                  variant="sectionTitle"
                >
                  {toDisplayValue(draftDate, "datetime")}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      </AppModal>
    </>
  );
}
