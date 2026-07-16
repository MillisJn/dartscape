// Vendored alongside scheduledDateTime.ts — see that file's header comment.

/** Formats a US-style number as it's typed: "5551234567" → "(555) 123-4567". Passes through anything
 * that isn't a plausible US number (longer digit runs, non-numeric input) unformatted. */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
