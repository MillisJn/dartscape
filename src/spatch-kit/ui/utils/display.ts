export function humanizeKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

export function toDisplayText(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export function getFallbackTitleField(row: Record<string, unknown>): string {
  const priority = [
    "name",
    "title",
    "address",
    "key",
    "fileName",
    "type",
    "status",
    "id",
  ];

  for (const field of priority) {
    if (toDisplayText(row[field])) {
      return field;
    }
  }

  return "id";
}
