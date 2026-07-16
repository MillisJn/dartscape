import type { DateFormatKey } from "@spatch-kit/theme/theme";

// Lives in theme/ (not ui/) so the theme provider can keep it in sync without an upward theme→ui import
// (a layer-boundary violation). ui/ + features/ consumers importing from theme/ is a normal downward edge.

// The app-wide human date/time format, driven by the Appearance "Date format" setting. The current key
// is a module-level value the theme provider keeps in sync (setAppDateFormat) whenever the preference
// changes; the theme provider re-renders the tree on that change, so every detail/meta view + picker
// field re-reads the formatter. Default "weekday" → "Fri, June 26" / "Fri, June 26, 2:00 PM".

let currentFormat: DateFormatKey = "weekday";

export function setAppDateFormat(key: DateFormatKey) {
  currentFormat = key;
}

function datePart(date: Date, key: DateFormatKey, withYear: boolean): string {
  const year = withYear ? ("numeric" as const) : undefined;
  switch (key) {
    case "medium":
      // "June 11, 2026" / "June 11"
      return date.toLocaleDateString([], {
        month: "long",
        day: "numeric",
        year,
      });
    case "full":
      // "Thursday, June 11, 2026" / "Thursday, June 11"
      return date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year,
      });
    case "weekday":
    default:
      // "Thu, June 11, 2026" / "Thu, June 11"
      return date.toLocaleDateString([], {
        weekday: "short",
        month: "long",
        day: "numeric",
        year,
      });
  }
}

export function formatAppDate(date: Date): string {
  return datePart(date, currentFormat, true);
}

// Same global format, minus the year — for contexts where the year is already visible nearby (e.g.
// the schedule picker summary, whose calendar header shows the month + year).
export function formatAppDateNoYear(date: Date): string {
  return datePart(date, currentFormat, false);
}

export function formatAppTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// A fixed, always-compact date (independent of the format preference) for tight field triggers —
// "6/30/26".
export function formatCompactDate(date: Date): string {
  return date.toLocaleDateString([], {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  });
}

export function formatAppDateTime(date: Date): string {
  return `${formatAppDate(date)}, ${formatAppTime(date)}`;
}
