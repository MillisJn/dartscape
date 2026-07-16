import type { ComponentType } from "react";

// The plain date-picker calendar surface. Its concrete implementation composes the scheduling
// month-grid components (tappable "Month Year" header + swipeable month pager), so it lives in
// features/scheduling and is registered here at startup (startup/registerUiSlots) — keeping ui/
// free of any import into features/. DateTimePicker renders whatever is registered.
export type BaseCalendarProps = {
  selectedDate?: Date | null;
  onSelectDate: (date: Date) => void;
};

export type BaseCalendarComponent = ComponentType<BaseCalendarProps>;

let registered: BaseCalendarComponent | null = null;

export function registerBaseCalendar(component: BaseCalendarComponent): void {
  registered = component;
}

export function getBaseCalendar(): BaseCalendarComponent | null {
  return registered;
}
