import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { View } from "react-native";

import {
  SlotWheel,
  type SlotItem,
  type SlotWheelHandle,
} from "@spatch-kit/ui/primitives/SlotWheel";
import { formatClockLabel, MINUTES_PER_DAY, snapToStep } from "@spatch-kit/ui/time/timeModel";
import type {
  TimeInputHandle,
  TimeInputProps,
} from "@spatch-kit/ui/primitives/timeInputTypes";

export type {
  TimeInputHandle,
  TimeInputProps,
} from "@spatch-kit/ui/primitives/timeInputTypes";

// One slot per 30 minutes across the day: "12:00 AM", "12:30 AM", … "11:30 PM". value = minute-of-day.
const SLOT_MINUTES = 30;
const TIME_SLOTS: SlotItem[] = Array.from(
  { length: MINUTES_PER_DAY / SLOT_MINUTES },
  (_, i) => {
    const minutes = i * SLOT_MINUTES;
    return { label: formatClockLabel(minutes), value: minutes };
  },
);

// Snap an arbitrary minute-of-day to the nearest 30-min slot the wheel can show (clamped to the last
// slot so it never rolls to the next day).
function snapToSlot(minutesOfDay: number) {
  return Math.max(
    0,
    Math.min(MINUTES_PER_DAY - SLOT_MINUTES, snapToStep(minutesOfDay, SLOT_MINUTES)),
  );
}

// NATIVE / default TimeInput: a single scrollable, looping list of 30-min time slots (the "time
// picker"). The web build swaps in TimeInput.web.tsx (a typeable field + dropdown) via the same
// props/handle, so TimeField / SchedulePickerModal / TimeRangeEditor are unchanged.
// `optionHint` is a web-only concern and is ignored here.
export const TimeInput = forwardRef<TimeInputHandle, TimeInputProps>(
  function TimeInput({ initialHour24, initialMinute, onChange }, ref) {
    const wheelRef = useRef<SlotWheelHandle | null>(null);

    const initialValue = useMemo(
      () => snapToSlot(initialHour24 * 60 + initialMinute),
      [initialHour24, initialMinute],
    );

    const handleChange = useCallback(
      (value: number) => {
        onChange(Math.floor(value / 60), value % 60);
      },
      [onChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        setTime(hour24: number, minute: number) {
          wheelRef.current?.scrollToValue(snapToSlot(hour24 * 60 + minute));
        },
      }),
      [],
    );

    return (
      <View className="items-center">
        <SlotWheel
          accessibilityLabel="Time"
          initialValue={initialValue}
          items={TIME_SLOTS}
          loop
          onChange={handleChange}
          ref={wheelRef}
          width={132}
        />
      </View>
    );
  },
);
