// Shared option lists for the schedule pickers' Start/Duration/Time SelectFields (an inline dropdown on
// desktop, a select box on mobile). value = minutes as a string.
import {
  formatClockLabel,
  formatDuration,
  MINUTES_PER_DAY,
} from "@spatch-kit/ui/time/timeModel";

// 15-min time-of-day options — matches the day timeline's snap granularity, so a dragged 8:15 still
// maps to an option.
const TIME_STEP = 15;

export const TIME_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / TIME_STEP },
  (_, i) => {
    const minutes = i * TIME_STEP;
    return { label: formatClockLabel(minutes), value: String(minutes) };
  },
);

// 30-min time-of-day options — the coarser step for the schedule picker's Start select.
export const TIME_OPTIONS_30 = Array.from(
  { length: MINUTES_PER_DAY / 30 },
  (_, i) => {
    const minutes = i * 30;
    return { label: formatClockLabel(minutes), value: String(minutes) };
  },
);

// Snap an arbitrary minute-of-day to the nearest 30-min slot (so a timeline drag to 8:15 still
// selects a Start option). Clamped to the last slot.
export function snapToHalfHour(minutesOfDay: number): number {
  const snapped = Math.round(minutesOfDay / 30) * 30;
  return Math.max(0, Math.min(MINUTES_PER_DAY - 30, snapped));
}

// 15m, 30m, 45m, 1h, … 12h — the Duration select's options. Starts at one step (a zero-length visit
// isn't selectable) and stops at 12h, past which visits don't run in practice.
const DURATION_STEP = 15;
const DURATION_MAX = 12 * 60;

export const DURATION_OPTIONS = Array.from(
  { length: DURATION_MAX / DURATION_STEP },
  (_, i) => {
    const minutes = (i + 1) * DURATION_STEP;
    return { label: formatDuration(minutes), value: String(minutes) };
  },
);
