// The single, platform-agnostic home for time/duration selection logic: parsing typed times,
// formatting clock/duration/range labels, the canonical snap, and the range reducer that every
// editing surface (typeable field, spinner, duration chips, day-view drag) routes through.
//
// Rank `ui`: may import @/core + utils; MUST NOT import features/* (a ui→features edge fails the
// layerBoundary test). Formatting lives here rather than in features/scheduling for the same reason.
//
// Values are stored as local wall-clock strings ("YYYY-MM-DDTHH:mm:00") — no timezone math (a range
// that would cross a DST boundary keeps its wall-clock times, matching the rest of the app).

import {
  getMinutesSinceStartOfDay,
  parseStoredDateTime,
  startOfDay,
  toStoredDateTime,
} from "@spatch-kit/utils/scheduledDateTime";

export const SNAP_STEP_MINUTES = 15;
// The day's conceptual upper bound: midnight = 1440 min. Used for geometry, duration math, and the
// duration LABEL (so a block ending at midnight reads as its true duration, never "1h 59m"). It
// SERIALIZES to 23:59 of the same day (buildStoredTime) so the value stays same-day-safe.
export const MINUTES_PER_DAY = 24 * 60;
const TERMINAL_STORED_MINUTES = MINUTES_PER_DAY - 1; // 23:59 — the serialized midnight endpoint

const DEFAULT_START_MINUTES = 12 * 60; // 12:00 PM, when a range has no start yet
const DEFAULT_DURATION_MINUTES = 60; // 1h fallback span for missing/invalid end (interaction only)

// The closed set of edit sources. Only "seed" (initial load / day reseed) is a non-intentional edit;
// every other origin is an explicit user edit and clears the draft's `pristine` latch.
export type EditOrigin =
  | "startInput"
  | "endInput"
  | "durationChip"
  | "timelineDrag"
  | "seed";

// The single source of truth for an in-progress range. `pristine` is a one-way latch: true means the
// loaded value has not been intentionally edited, so it must serialize back VERBATIM (the legacy
// pass-through guarantee for overnight/malformed data). The reducer is the only place it flips false.
export type TimeRangeDraft = {
  startISO: string;
  endISO: string;
  pristine: boolean;
};

export type RangeEdit =
  | { origin: "seed"; startISO: string; endISO: string }
  | { origin: "startInput"; hour24: number; minute: number }
  | { origin: "endInput"; hour24: number; minute: number }
  | { origin: "durationChip"; minutes: number }
  | { origin: "timelineDrag"; startMinutes: number; endMinutes: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// The canonical snap — nearest multiple of `step`. Callers clamp to their own domain (minute-of-hour
// vs minute-of-day). Replaces the two divergent private copies that used to live in TimeWheels and
// ScheduleDayTimeline.
export function snapToStep(value: number, step: number = SNAP_STEP_MINUTES) {
  return Math.round(value / step) * step;
}

function clockToMinutes(hour24: number, minute: number) {
  return hour24 * 60 + minute;
}

// Parse a free-typed time. Accepts "3", "3p", "3 pm", "3:15 PM", "9:30", "14:30", "230", "1430".
// Returns 24h {hour24, minute}, or null when it can't be understood. Deliberately literal (no
// snapping) — the exact typed time is what gets stored; the dropdown handles discoverability.
export function parseTypedTime(
  text: string,
): { hour24: number; minute: number } | null {
  const raw = text.trim().toLowerCase().replace(/\./g, "");
  if (!raw) {
    return null;
  }

  // 12-hour with an am/pm marker: "3", "3p", "3:15pm".
  const meridiem = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(a|p)m?$/);
  if (meridiem) {
    const rawHour = Number.parseInt(meridiem[1], 10);
    const minute = meridiem[2] ? Number.parseInt(meridiem[2], 10) : 0;
    if (rawHour < 1 || rawHour > 12 || minute > 59) {
      return null;
    }
    const isPm = meridiem[3] === "p";
    return { hour24: (rawHour % 12) + (isPm ? 12 : 0), minute };
  }

  // 24-hour (or bare) with a colon: "9:30", "14:30".
  const colon = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const hour24 = Number.parseInt(colon[1], 10);
    const minute = Number.parseInt(colon[2], 10);
    if (hour24 > 23 || minute > 59) {
      return null;
    }
    return { hour24, minute };
  }

  // Bare digits: 1-2 = hour ("9" → 09:00), 3-4 = HMM/HHMM ("230" → 02:30, "1430" → 14:30).
  const digits = raw.match(/^(\d{1,4})$/);
  if (digits) {
    const value = digits[1];
    if (value.length <= 2) {
      const hour24 = Number.parseInt(value, 10);
      return hour24 > 23 ? null : { hour24, minute: 0 };
    }
    const minute = Number.parseInt(value.slice(-2), 10);
    const hour24 = Number.parseInt(value.slice(0, -2), 10);
    if (hour24 > 23 || minute > 59) {
      return null;
    }
    return { hour24, minute };
  }

  return null;
}

// Format a minute-of-day (0..1440) as a clock label. 1440 → "12:00 AM" (midnight terminal).
export function formatClockLabel(minutesOfDay: number) {
  const normalized = ((minutesOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return new Date(2000, 0, 1, hour24, minute).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(hour24: number, minute: number) {
  return formatClockLabel(clockToMinutes(hour24, minute));
}

export function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) {
    return `${hours}h ${mins}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

// "9:00 AM – 12:00 AM · 3h" — the TimeRangeField summary. Works in conceptual minutes so a block
// ending at midnight shows its true duration.
export function formatRangeSummary(startMinutes: number, endMinutes: number) {
  return `${formatClockLabel(startMinutes)} – ${formatClockLabel(endMinutes)} · ${formatDuration(endMinutes - startMinutes)}`;
}

// Serialize a minute-of-day onto `day`. The conceptual terminal (>= 1440 = midnight) serializes to
// 23:59 so the value never rolls to the next date (same-day guarantee).
export function buildStoredTime(day: Date, minutesOfDay: number) {
  const next = new Date(day);
  if (minutesOfDay >= MINUTES_PER_DAY) {
    next.setHours(23, 59, 0, 0);
  } else {
    next.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  }
  return toStoredDateTime(next);
}

// The interaction view of a draft, in CONCEPTUAL minutes. Falls back to sensible values for
// missing/invalid data (never rewrites storage). A stored end <= start (a true overnight span) or a
// serialized-midnight 23:59 both read back as the 1440 terminal so the block renders same-day and the
// duration label is clean.
export function resolveDraftMinutes(draft: TimeRangeDraft, baseDate: Date) {
  const startDate = parseStoredDateTime(draft.startISO);
  const startMinutes = startDate
    ? getMinutesSinceStartOfDay(startDate)
    : DEFAULT_START_MINUTES;

  const endDate = parseStoredDateTime(draft.endISO);
  let endMinutes: number;
  if (endDate) {
    const raw = getMinutesSinceStartOfDay(endDate);
    endMinutes = raw <= startMinutes || raw === TERMINAL_STORED_MINUTES
      ? MINUTES_PER_DAY
      : raw;
  } else {
    endMinutes = Math.min(
      MINUTES_PER_DAY,
      startMinutes + DEFAULT_DURATION_MINUTES,
    );
  }

  return { startMinutes, endMinutes };
}

// The ONE normalizer. Given the current draft, an edit tagged with its origin, and the anchor day,
// returns the next draft — snapping/clamping same-day and preserving duration on a start edit. It is
// the ONLY place `pristine` flips to false, and only when the edit actually changes the effective
// (conceptual) minutes: a no-op edit (Enter/blur on unchanged text, re-selecting the current option)
// returns the draft untouched, so an untouched legacy value keeps its pass-through guarantee.
export function applyRangeEdit(
  draft: TimeRangeDraft,
  edit: RangeEdit,
  baseDate: Date,
): TimeRangeDraft {
  if (edit.origin === "seed") {
    return { startISO: edit.startISO, endISO: edit.endISO, pristine: true };
  }

  const day = startOfDay(parseStoredDateTime(draft.startISO) ?? baseDate);
  const { startMinutes, endMinutes } = resolveDraftMinutes(draft, baseDate);
  const duration = Math.max(SNAP_STEP_MINUTES, endMinutes - startMinutes);

  let nextStart = startMinutes;
  let nextEnd = endMinutes;

  switch (edit.origin) {
    case "startInput": {
      // Typed/selected exactly — no snap. Preserve duration, clamp the end at the terminal.
      nextStart = clamp(
        clockToMinutes(edit.hour24, edit.minute),
        0,
        MINUTES_PER_DAY - 1,
      );
      nextEnd = Math.min(MINUTES_PER_DAY, nextStart + duration);
      break;
    }
    case "endInput": {
      // "12:00 AM" (00:00) as an END means midnight / end-of-day (the terminal), not 0 minutes.
      const typed = clockToMinutes(edit.hour24, edit.minute);
      const asEnd = typed === 0 ? MINUTES_PER_DAY : typed;
      nextEnd = asEnd <= nextStart
        ? Math.min(MINUTES_PER_DAY, nextStart + SNAP_STEP_MINUTES)
        : Math.min(asEnd, MINUTES_PER_DAY);
      break;
    }
    case "durationChip": {
      nextEnd = Math.min(
        MINUTES_PER_DAY,
        nextStart + Math.max(SNAP_STEP_MINUTES, edit.minutes),
      );
      break;
    }
    case "timelineDrag": {
      // The one origin that snaps (to the 15-min grid).
      nextStart = clamp(snapToStep(edit.startMinutes), 0, MINUTES_PER_DAY - 1);
      nextEnd = clamp(
        snapToStep(edit.endMinutes),
        nextStart + SNAP_STEP_MINUTES,
        MINUTES_PER_DAY,
      );
      break;
    }
  }

  // No effective change → preserve the draft (and its `pristine` latch) exactly.
  if (nextStart === startMinutes && nextEnd === endMinutes) {
    return draft;
  }

  return {
    startISO: buildStoredTime(day, nextStart),
    endISO: buildStoredTime(day, nextEnd),
    pristine: false,
  };
}

// Convenience: seed a draft from stored strings (pristine).
export function seedRangeDraft(startISO: string, endISO: string): TimeRangeDraft {
  return { startISO: startISO ?? "", endISO: endISO ?? "", pristine: true };
}

// Split a minute-of-day into a 24h clock. The conceptual terminal (>= 1440 = midnight) displays as
// 12:00 AM (hour 0), so a range ending at midnight seeds its editor cleanly.
export function clockOfMinutes(minutes: number) {
  if (minutes >= MINUTES_PER_DAY) {
    return { hour24: 0, minute: 0 };
  }
  return { hour24: Math.floor(minutes / 60), minute: minutes % 60 };
}
