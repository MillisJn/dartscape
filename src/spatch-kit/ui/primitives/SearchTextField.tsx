import { useEffect, useRef, useState, type ComponentProps } from "react";

import { useTheme } from "@spatch-kit/theme/provider";
import { IconButton } from "@spatch-kit/ui/primitives/IconButton";
import { TextField } from "@spatch-kit/ui/primitives/TextField";

type PassthroughProps = Pick<
  ComponentProps<typeof TextField>,
  | "autoFocus"
  | "autoCapitalize"
  | "autoCorrect"
  | "inputRef"
  | "returnKeyType"
  | "onSubmitEditing"
  | "className"
>;

type SearchTextFieldProps = PassthroughProps & {
  // Parent-owned query — the source of truth. The field keeps a local echo for instant typing and
  // only pushes back via onDebouncedChange after the user pauses.
  value: string;
  onDebouncedChange: (text: string) => void;
  debounceMs?: number;
  placeholder?: string;
  clearLabel?: string;
};

// The app's shared search input — used by every search surface (Search, Maps, the entity table, the
// entity-picker modal, and the ⌘K quick search). It debounces so the query doesn't run on every
// keystroke, and exposes an X to clear. The tricky part is staying in sync with the parent `value`
// WITHOUT letting a late echo of our own emitted value clobber newer uncommitted keystrokes:
//   - The local `text` is what the user sees and types.
//   - `lastEmittedRef` remembers the value we last handed to the parent.
//   - The sync effect adopts an incoming `value` ONLY when it differs from what we emitted — i.e. an
//     intentional external change (clear button elsewhere, tab switch, deep link, restored nav state).
//     A `value` that merely equals our last emit is the parent echoing us back and is ignored.
export function SearchTextField({
  value,
  onDebouncedChange,
  debounceMs = 250,
  placeholder = "Search",
  clearLabel = "Clear search",
  ...passthrough
}: SearchTextFieldProps) {
  const theme = useTheme();
  const [text, setText] = useState(value);
  const lastEmittedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Emit immediately, cancelling any pending debounce (used by the clear button so the results wipe at
  // once rather than after the delay).
  const emitNow = (next: string) => {
    clearTimer();
    lastEmittedRef.current = next;
    onDebouncedChange(next);
  };

  const handleType = (next: string) => {
    setText(next);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      lastEmittedRef.current = next;
      onDebouncedChange(next);
    }, debounceMs);
  };

  const handleClear = () => {
    setText("");
    emitNow("");
  };

  // Adopt intentional external changes only (see header note). Skip when `value` is just re-broadcasting
  // our last emit, so a delayed parent update can't overwrite newer typing.
  useEffect(() => {
    if (value !== lastEmittedRef.current && value !== text) {
      clearTimer();
      lastEmittedRef.current = value;
      setText(value);
    }
    // `text` intentionally excluded — this reacts to external `value` pushes, not local typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Flush any pending debounce on unmount so a scheduled emit never fires into an unmounted parent.
  useEffect(() => clearTimer, []);

  return (
    <TextField
      {...passthrough}
      leadingIcon="search"
      onChangeText={handleType}
      placeholder={placeholder}
      // Let the field reflect programmatic clears/external changes even while focused (the X clear is
      // often tapped with the input still focused).
      syncExternalValueWhileFocused
      trailingAccessory={
        text.length > 0 ? (
          <IconButton
            icon="close"
            label={clearLabel}
            onPress={handleClear}
            style={{
              // The IconButton's 44px touch target is taller than the single-line
              // text row, so left alone it stretches the field taller the moment
              // the clear button appears. Pull it back into the line with symmetric
              // negative margins: the field keeps its height and the shell wrapper's
              // justify-center keeps the glyph perfectly vertically centered. The
              // right margin eases the glyph off the field's right edge.
              marginVertical: -theme.space.sm,
              marginRight: theme.space.sm,
            }}
          />
        ) : null
      }
      value={text}
    />
  );
}
