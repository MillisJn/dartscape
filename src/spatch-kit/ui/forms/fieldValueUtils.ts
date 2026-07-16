// Maps a domain field's declared format to runtime input behavior: which on-screen
// keyboard to show, how many decimals to allow, and — the fiddly part —
// sanitizeNumericFieldValue, which cleans each keystroke as the user types so a
// field can only ever hold a well-formed value.
import type { KeyboardTypeOptions } from "react-native";

// The kit may not import a host app's domain/schema layer (an upward edge — see the RANK table in
// layerBoundary.test.ts), so it declares the field shape it actually READS rather than borrowing the
// app's. Kept STRUCTURAL on purpose: a richer app-side field config satisfies KitFieldConfig, and its
// format union is the same set of strings, so call sites pass domain values straight in with no cast.
// Nothing in the compiler keeps the two unions aligned, so kitFieldFormatParity.test.ts does — if you
// take this kit into another app, either retarget that test at your own union or drop it.
export type KitFieldFormat =
  | "address"
  | "geometry"
  | "color"
  | "text"
  | "email"
  | "phone"
  | "number"
  | "currency"
  | "percent"
  | "boolean"
  | "datetime"
  | "date";

// The only two properties every function below reads off a field's config.
export type KitFieldConfig = {
  decimals?: number;
  format?: KitFieldFormat;
};

export type FieldValueBehavior =
  | "text"
  | "integer"
  | "decimal"
  | "currency"
  | "phone"
  | "email"
  | "address";

// Up to a 3-digit country code + a longer international subscriber number. E.164 caps at 15 digits;
// 16 leaves a little slack so a pasted number with an extra digit isn't silently truncated mid-entry.
const MAX_PHONE_DIGITS = 16;

function countOccurrences(value: string, target: string) {
  return value.split(target).length - 1;
}

// Strip insignificant leading zeros ("01" → "1") while preserving the cases where a
// leading zero is meaningful: a bare "0", and "0.x" / "-0.x" decimals. Sign is kept.
function trimLeadingZeroes(value: string) {
  if (
    !value ||
    value === "0" ||
    value.startsWith("0.") ||
    value.startsWith("-0.")
  ) {
    return value;
  }

  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = sign ? value.slice(1) : value;
  const trimmed = unsigned.replace(/^0+(?=\d)/, "");

  return `${sign}${trimmed}`;
}

export function getFieldValueBehavior(
  fieldConfig: KitFieldConfig | undefined,
): FieldValueBehavior {
  if (fieldConfig?.format === "phone") {
    return "phone";
  }

  if (fieldConfig?.format === "email") {
    return "email";
  }

  if (fieldConfig?.format === "address") {
    return "address";
  }

  if (fieldConfig?.format === "currency") {
    return "currency";
  }

  if (fieldConfig?.format === "number" || fieldConfig?.format === "percent") {
    return fieldConfig.decimals === 0 ? "integer" : "decimal";
  }

  return "text";
}

export function getFieldDecimals(
  fieldConfig: KitFieldConfig | undefined,
): number | undefined {
  if (typeof fieldConfig?.decimals === "number") {
    return Math.max(0, fieldConfig.decimals);
  }

  if (fieldConfig?.format === "currency") {
    return 2;
  }

  return undefined;
}

export function getFieldKeyboardType(
  fieldConfig: KitFieldConfig | undefined,
): KeyboardTypeOptions | undefined {
  const format = fieldConfig?.format;
  const behavior = getFieldValueBehavior(fieldConfig);

  if (format === "email") {
    return "email-address";
  }

  if (format === "phone") {
    return "phone-pad";
  }

  if (format === "address") {
    return "default";
  }

  if (behavior === "integer") {
    return "number-pad";
  }

  if (behavior === "decimal" || behavior === "currency") {
    return "decimal-pad";
  }

  return undefined;
}

/**
 * Clean a single field value per its behavior, applied on every keystroke:
 *   - phone: digits only, capped at MAX_PHONE_DIGITS (e.g. "+1 (555) 555-5555").
 *   - text: passthrough.
 *   - email/address: strip newlines (single-line inputs) but keep everything else.
 *   - integer/decimal/currency: keep only digits, one optional leading "-", and
 *     (for decimals) a single "." limited to `decimals` places.
 */
export function sanitizeNumericFieldValue(
  value: string,
  behavior: FieldValueBehavior,
  decimals: number | undefined,
): string {
  if (behavior === "phone") {
    return value.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
  }

  if (behavior === "text") {
    return value;
  }

  if (behavior === "email" || behavior === "address") {
    return value.replace(/[\r\n]/g, "");
  }

  // Drop thousands separators and any char that isn't a digit, dot, or minus.
  let next = value.replace(/,/g, "").replace(/[^0-9.-]/g, "");

  if (!next) {
    return "";
  }

  // Collapse stray minus signs to a single leading sign ("5-3" → "53", "-5" stays).
  const isNegative = next.startsWith("-");
  next = `${isNegative ? "-" : ""}${next.replace(/-/g, "")}`;

  if (behavior === "integer") {
    return trimLeadingZeroes(next.replace(/\./g, ""));
  }

  // Decimals: keep only the first ".", merging any later digits into the fraction.
  const firstDotIndex = next.indexOf(".");

  if (firstDotIndex >= 0 && countOccurrences(next, ".") > 1) {
    next = `${next.slice(0, firstDotIndex + 1)}${next
      .slice(firstDotIndex + 1)
      .replace(/\./g, "")}`;
  }

  // Truncate (not round) the fraction to the configured number of decimal places.
  if (firstDotIndex >= 0 && typeof decimals === "number") {
    const integerPart = next.slice(0, firstDotIndex);
    const decimalPart = next.slice(
      firstDotIndex + 1,
      firstDotIndex + 1 + decimals,
    );
    next = `${integerPart}.${decimalPart}`;
  }

  return trimLeadingZeroes(next);
}

export function formatFieldValueForDisplay(
  value: string,
  format: KitFieldFormat | undefined,
  decimals: number | undefined,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const numeric = Number(trimmed.replace(/,/g, ""));

  if (!Number.isFinite(numeric)) {
    return value;
  }

  if (format === "currency") {
    return new Intl.NumberFormat(undefined, {
      currency: "USD",
      maximumFractionDigits: decimals ?? 2,
      minimumFractionDigits: decimals ?? 2,
      style: "currency",
    }).format(numeric);
  }

  if (format === "number" || format === "percent") {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: decimals ?? 2,
      minimumFractionDigits: decimals ?? 0,
    }).format(numeric);
  }

  return value;
}
