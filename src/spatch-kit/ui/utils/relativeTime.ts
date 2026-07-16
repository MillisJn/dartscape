// Human-friendly "time ago" formatting for stored ISO timestamps. Shared across
// surfaces (the record audit footer, entity cards) so the wording can't drift.

// "Just now" / "5m ago" / "3h ago" / "Yesterday" / "4 days ago", falling back to a
// short absolute date ("Jun 12") past a week. Returns null for an absent/unparseable
// value so callers can omit the line entirely rather than render "Invalid Date".
export function formatRelativeTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) {
    return null;
  }

  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// A PURELY relative label — "Just now" / "5m ago" / "3h ago" / "Yesterday" /
// "4 days ago" — returning null once older than a week (no date fallback), so a caller
// can pair it with an absolute date instead. Used as the lead-in of the audit footer's
// subheader ("Yesterday, Jun 19, 2026, 3:14 PM").
export function formatRelativeLabel(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) {
    return null;
  }

  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return null;
}

// The stored timestamp as an absolute, human-readable date + time
// ("Jun 19, 2026, 3:14 PM"). Null for an absent/unparseable value.
export function formatAbsoluteDateTime(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) {
    return null;
  }

  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return new Date(time).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// A full weekday + date, no time ("Thu, June 11, 2026"). Null for an absent/unparseable value.
// For surfaces where the date IS the row's main secondary line and wants to read as a real date
// rather than a terse numeric one.
export function formatFullDate(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) {
    return null;
  }

  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "short",
    year: "numeric",
  });
}

// A compact numeric date ("3/4/24"). Null for an absent/unparseable value. Used by the notes
// desktop table's "Created by … on 3/4/24" cell.
export function formatShortDate(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) {
    return null;
  }

  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
}
