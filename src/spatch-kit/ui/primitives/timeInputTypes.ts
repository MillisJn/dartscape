// Shared contract for the TimeInput platform seam (TimeInput.tsx = native spinner,
// TimeInput.web.tsx = typeable field + dropdown). Kept in a platform-neutral file so both variants
// and their importers agree on one type.

export type TimeInputHandle = {
  // Animate/set the editor to a 24h time chosen elsewhere (e.g. by dragging the day-view grid).
  // Does NOT re-fire onChange — the caller owns the value.
  setTime: (hour24: number, minute: number) => void;
};

export type TimeInputProps = {
  // Seed positions, read once on mount (the editor is uncontrolled after). Hosts mount this inside a
  // modal that unmounts on close, so each open remounts it with a fresh seed.
  initialHour24: number;
  initialMinute: number;
  // Fires as the selection settles, with the combined 24h time.
  onChange: (hour24: number, minute: number) => void;
  // Optional per-option hint shown in the web dropdown (e.g. TimeRangeField shows the duration from
  // the current start beside each end option). No-op on native — the spinner has no option list.
  optionHint?: (hour24: number, minute: number) => string;
};
