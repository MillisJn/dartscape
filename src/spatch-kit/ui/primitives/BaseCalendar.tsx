import { getBaseCalendar, type BaseCalendarProps } from "./calendarSlot";

export type { BaseCalendarProps } from "./calendarSlot";

// Thin ui/ entry point for the plain date-picker calendar. The real implementation composes the
// scheduling month-grid components, so it lives in features/scheduling and is registered into the
// calendar slot at startup — letting DateTimePicker render it without ui/ ever importing features/.
// Renders nothing until the slot is registered (registerUiSlots runs at app root before any field
// opens); in an isolated unit render it is simply inert.
export function BaseCalendar(props: BaseCalendarProps) {
  const Calendar = getBaseCalendar();
  return Calendar ? <Calendar {...props} /> : null;
}
