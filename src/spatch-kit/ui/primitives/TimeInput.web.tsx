import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, View, type TextInput } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { useOverlayRegistration } from "@spatch-kit/ui/overlays/core/dismissal";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { DropdownSurface } from "@spatch-kit/ui/primitives/DropdownSurface";
import { TextField } from "@spatch-kit/ui/primitives/TextField";
import {
  formatTime,
  MINUTES_PER_DAY,
  parseTypedTime,
  SNAP_STEP_MINUTES,
} from "@spatch-kit/ui/time/timeModel";
import type { TimeInputHandle, TimeInputProps } from "@spatch-kit/ui/primitives/timeInputTypes";

export type { TimeInputHandle, TimeInputProps } from "@spatch-kit/ui/primitives/timeInputTypes";

const ROW_HEIGHT = 40;
const BLUR_COMMIT_DELAY_MS = 120; // long enough for an option click to cancel the blur commit

type TimeOption = { minutes: number; hour24: number; minute: number };

const TIME_OPTIONS: TimeOption[] = Array.from(
  { length: MINUTES_PER_DAY / SNAP_STEP_MINUTES },
  (_, i) => {
    const minutes = i * SNAP_STEP_MINUTES;
    return { minutes, hour24: Math.floor(minutes / 60), minute: minutes % 60 };
  },
);

function nearestOptionIndex(hour24: number, minute: number) {
  const total = hour24 * 60 + minute;
  return Math.min(
    TIME_OPTIONS.length - 1,
    Math.max(0, Math.round(total / SNAP_STEP_MINUTES)),
  );
}

function clampIndex(index: number) {
  return Math.min(TIME_OPTIONS.length - 1, Math.max(0, index));
}

// WEB TimeInput: a typeable time field + a 15-min dropdown (Google-Calendar style). Type "2:30p" or
// "1430", or arrow/click through the list — keyboard-first for mouse+keyboard. Same props/handle as
// the native spinner (TimeInput.tsx), so TimeField / SchedulePickerModal pick it up
// with zero changes. `optionHint` (used by TimeRangeField's end input) annotates each row with the
// duration from the current start.
export const TimeInput = forwardRef<TimeInputHandle, TimeInputProps>(
  function TimeInput(
    { initialHour24, initialMinute, onChange, optionHint },
    ref,
  ) {
    const theme = useTheme();
    const value = useRef({ hour24: initialHour24, minute: initialMinute });
    const [text, setText] = useState(formatTime(initialHour24, initialMinute));
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(() =>
      nearestOptionIndex(initialHour24, initialMinute),
    );

    const containerRef = useRef<View | null>(null);
    const inputRef = useRef<TextInput | null>(null);
    const scrollRef = useRef<ScrollView | null>(null);
    const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Fresh snapshot for the DOM keydown handler (attached once) so it never reads stale state.
    const stateRef = useRef({ open, highlight, text });
    stateRef.current = { open, highlight, text };

    const close = () => setOpen(false);
    useOverlayRegistration(open, close);

    function openList() {
      setHighlight(nearestOptionIndex(value.current.hour24, value.current.minute));
      setOpen(true);
    }

    // Commit a concrete time. Only fires onChange when it actually changes — so re-selecting the
    // current option / Enter on unchanged text never clears the host draft's `pristine` latch.
    function commit(hour24: number, minute: number) {
      const changed =
        value.current.hour24 !== hour24 || value.current.minute !== minute;
      value.current = { hour24, minute };
      setText(formatTime(hour24, minute));
      setHighlight(nearestOptionIndex(hour24, minute));
      if (changed) {
        onChange(hour24, minute);
      }
    }

    // Blur/Enter: parse the typed text and commit; empty or unparseable reverts to the current value
    // (the inner editor always holds a time — clearing is a field-level concern).
    function commitFromText() {
      const parsed = parseTypedTime(stateRef.current.text);
      if (parsed) {
        commit(parsed.hour24, parsed.minute);
      } else {
        setText(formatTime(value.current.hour24, value.current.minute));
      }
    }

    function clearBlurTimer() {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        setTime(hour24: number, minute: number) {
          value.current = { hour24, minute };
          setText(formatTime(hour24, minute));
          setHighlight(nearestOptionIndex(hour24, minute));
        },
      }),
      [],
    );

    // Keep the highlighted row in view as it moves / on open.
    useEffect(() => {
      if (!open) {
        return;
      }
      const y = Math.max(0, highlight * ROW_HEIGHT - ROW_HEIGHT * 2);
      scrollRef.current?.scrollTo({ y, animated: false });
    }, [open, highlight]);

    // Arrow/Enter/Escape via a DOM keydown listener on the field container (mirrors TextField's own
    // web DOM listener pattern; more reliable than RN's onKeyPress for arrow keys).
    useEffect(() => {
      const node = containerRef.current as unknown as HTMLElement | null;
      if (!node) {
        return;
      }
      const onKeyDown = (event: KeyboardEvent) => {
        const snapshot = stateRef.current;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (!snapshot.open) {
            openList();
          } else {
            setHighlight((h) => clampIndex(h + 1));
          }
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          if (!snapshot.open) {
            openList();
          } else {
            setHighlight((h) => clampIndex(h - 1));
          }
        } else if (event.key === "Enter") {
          event.preventDefault();
          clearBlurTimer();
          if (snapshot.open && snapshot.highlight >= 0) {
            const option = TIME_OPTIONS[snapshot.highlight];
            commit(option.hour24, option.minute);
          } else {
            commitFromText();
          }
          close();
        } else if (event.key === "Escape") {
          if (snapshot.open) {
            event.preventDefault();
            setText(formatTime(value.current.hour24, value.current.minute));
            close();
          }
        }
      };
      node.addEventListener("keydown", onKeyDown);
      return () => node.removeEventListener("keydown", onKeyDown);
      // Attached once; reads live state via stateRef and functional setState.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => () => clearBlurTimer(), []);

    return (
      <View className="w-full">
        <TextField
          containerRef={containerRef}
          inputRef={inputRef}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(next) => {
            setText(next);
            if (!open) {
              setOpen(true);
            }
            const parsed = parseTypedTime(next);
            if (parsed) {
              setHighlight(nearestOptionIndex(parsed.hour24, parsed.minute));
            }
          }}
          onFocus={openList}
          onBlur={() => {
            clearBlurTimer();
            blurTimer.current = setTimeout(() => {
              commitFromText();
              close();
            }, BLUR_COMMIT_DELAY_MS);
          }}
          placeholder="e.g. 2:30 PM"
          trailingAccessory={
            <Pressable
              accessibilityLabel="Show times"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                clearBlurTimer();
                if (open) {
                  close();
                } else {
                  inputRef.current?.focus();
                  openList();
                }
              }}
              className="h-full items-center justify-center px-app-sm"
            >
              <AppIcon name={open ? "chevronUp" : "chevronDown"} size={theme.type.caption + 5} />
            </Pressable>
          }
          value={text}
        />

        <DropdownSurface anchorRef={containerRef} onClose={close} visible={open}>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">
            {TIME_OPTIONS.map((option, index) => {
              const isHighlighted = index === highlight;
              const isCurrent =
                option.hour24 === value.current.hour24 &&
                option.minute === value.current.minute;
              const hint = optionHint?.(option.hour24, option.minute);
              return (
                <Pressable
                  key={option.minutes}
                  onPress={() => {
                    clearBlurTimer();
                    commit(option.hour24, option.minute);
                    close();
                  }}
                  onHoverIn={() => setHighlight(index)}
                  className={isHighlighted ? "bg-accent-muted" : undefined}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    height: ROW_HEIGHT,
                    justifyContent: "space-between",
                    paddingHorizontal: theme.space.md,
                  }}
                >
                  <AppText color={isCurrent ? "accent" : "text"} variant="body">
                    {formatTime(option.hour24, option.minute)}
                  </AppText>
                  {hint ? (
                    <AppText color="mutedText" variant="caption">
                      {hint}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </DropdownSurface>
      </View>
    );
  },
);
