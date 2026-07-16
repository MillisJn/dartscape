// Vendored: the origin app's platform-neutral date/time helpers, lifted in because this app did not
// take the origin's @/core/utils package. See kitBoundary.test.ts's ALLOWED_ALIAS_PREFIXES comment —
// this file plus phone.ts are the two helpers ui/primitives/TextField and ui/time/* need. Local wall
// clock only, no timezone math: values are stored as "YYYY-MM-DDTHH:mm:00" strings.

export function padScheduleNumber(value: number): string {
  return String(value).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:mm:00" (or "YYYY-MM-DD") → local Date, or null if unparseable/empty. */
export function parseStoredDateTime(value: string): Date | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour ? Number(hour) : 0,
    minute ? Number(minute) : 0,
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local Date → "YYYY-MM-DDTHH:mm:00". */
export function toStoredDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${padScheduleNumber(date.getMonth() + 1)}-${padScheduleNumber(date.getDate())}` +
    `T${padScheduleNumber(date.getHours())}:${padScheduleNumber(date.getMinutes())}:00`
  );
}

/** Midnight of the given date's day, local time. */
export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getMinutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
