import {
  memo,
  useEffect,
  useState,
  type ReactNode,
  type ComponentProps,
  type Ref,
  type RefObject,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useRef } from "react";

import { useTheme } from "@spatch-kit/theme/provider";
import {
  formatFieldValueForDisplay,
  sanitizeNumericFieldValue,
  type FieldValueBehavior,
  type KitFieldFormat,
} from "@spatch-kit/ui/forms/fieldValueUtils";
import { formatPhoneNumber } from "@spatch-kit/utils/phone";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { FloatingFieldShell } from "@spatch-kit/ui/primitives/FloatingFieldShell";
import { deferPastCommit } from "@spatch-kit/ui/utils/deferPastCommit";

type TextFieldProps = ComponentProps<typeof TextInput> & {
  label?: string;
  caption?: string;
  containerRef?: RefObject<View | null>;
  inputRef?: Ref<TextInput>;
  nextFocusRef?: RefObject<TextInput | null>;
  decimals?: number;
  fieldFormat?: KitFieldFormat;
  fieldValueBehavior?: FieldValueBehavior;
  invalid?: boolean;
  errorMessage?: string | null;
  leadingIcon?: IconName;
  trailingAccessory?: ReactNode;
  className?: string;
  inputClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  focusOverlayStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  shellClassName?: string;
  shellStyle?: StyleProp<ViewStyle>;
  syncExternalValueWhileFocused?: boolean;
};

function TextFieldComponent({
  autoFocus,
  label,
  caption,
  containerRef,
  inputRef,
  nextFocusRef,
  decimals,
  fieldFormat,
  fieldValueBehavior = "text",
  invalid = false,
  leadingIcon,
  trailingAccessory,
  className,
  containerStyle,
  focusOverlayStyle: focusOverlayStyleOverride,
  inputClassName,
  inputStyle,
  shellClassName,
  shellStyle,
  syncExternalValueWhileFocused = false,
  onBlur,
  onChangeText,
  onEndEditing,
  onFocus,
  onSubmitEditing,
  returnKeyType,
  style,
  errorMessage,
  value,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const isMultiline = rest.multiline === true;
  const isCurrencyField = fieldValueBehavior === "currency";
  // Keyed off the declared format (not the behavior) so it also catches phone
  // fields that pass only `fieldFormat="phone"`, e.g. Company Settings.
  const isPhoneField = fieldFormat === "phone";
  const isEditable = rest.editable !== false;
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(String(value ?? ""));
  // The latest value we've emitted up to the parent. While non-null, the parent may not have
  // echoed it back yet (its state trails typing by an async render), and those lagging echoes must
  // NOT be adopted into displayValue or the last typed chars visibly blink out and back in. Cleared
  // once the parent's `value` catches up, so genuine EXTERNAL changes sync normally again.
  const pendingLocalValueRef = useRef<string | null>(null);
  const focusProgress = useRef(new Animated.Value(0)).current;
  const internalInputRef = useRef<TextInput | null>(null);
  const internalContainerRef = useRef<View | null>(null);

  function assignInputRef(node: TextInput | null) {
    internalInputRef.current = node;
    if (!inputRef) return;
    if (typeof inputRef === "function") {
      inputRef(node);
    } else {
      (inputRef as React.MutableRefObject<TextInput | null>).current = node;
    }
  }

  function assignContainerRef(node: View | null) {
    internalContainerRef.current = node;
    if (containerRef) {
      (containerRef as React.MutableRefObject<View | null>).current = node;
    }
  }

  // Deferred autofocus — DO NOT forward RN's native `autoFocus` prop to the raw <TextInput>.
  // On native (Fabric / New Architecture) that focuses the input as it ATTACHES to the window,
  // which synchronously fires showSoftInput → focusSearch → FabricUIManager.findNextFocusableElement.
  // When that runs while the Fabric view tree is still being mutated (e.g. a screen mounting during a
  // rapid push→pop of a create form), it dereferences a freed shadow node and the process aborts
  // natively: "Scudo ERROR: invalid chunk state" (SIGABRT) — uncatchable by the JS error boundary.
  // Running the focus AFTER the mount commit/paint settle moves it out of the mount commit, so the
  // focus search walks a stable tree. Web keeps the immediate focus (no Fabric; QuickSearch wants it
  // instant), and the cancel guards a rapid unmount so we never focus a torn-down input.
  useEffect(() => {
    if (!autoFocus || !isEditable) return;
    if (Platform.OS === "web") {
      internalInputRef.current?.focus();
      return;
    }
    return deferPastCommit(() => {
      internalInputRef.current?.focus();
    });
    // Focus once on mount for the field flagged to auto-focus; `autoFocus` is stable per field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  // Web: the input only occupies a one-line-tall slot at the bottom of the
  // field (the rest is the padding "lane" reserved for the floating label), so
  // clicking the upper part of the field would miss the input. Forward those
  // chrome/padding clicks to the input. A plain View isn't focusable, so it
  // never steals focus from an already-focused input — clicking inside a
  // focused field is a no-op rather than a blur→refocus that replays the label
  // animation. Clicks on the input itself (or on accessory buttons) are left
  // to their native handling.
  useEffect(() => {
    if (Platform.OS !== "web" || !isEditable) return;
    const node = internalContainerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const focusInputFromChrome = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (target.closest('[role="button"], button, a')) return;
      // Prevent the browser's default mousedown focus handling, which would
      // otherwise blur the input (the chrome isn't focusable) right after we
      // focus it — causing a focused field to lose focus on a repeat click.
      event.preventDefault();
      internalInputRef.current?.focus();
    };

    node.addEventListener("mousedown", focusInputFromChrome);
    return () => node.removeEventListener("mousedown", focusInputFromChrome);
  }, [isEditable]);
  const multilineLineCount = Math.max(rest.numberOfLines ?? 4, 3);
  const multilineMinHeight =
    theme.type.bodyLineHeight * multilineLineCount + theme.space.md;
  // Reserve a constant top "lane" for the floating label so the single-line
  // field keeps the same height whether it's resting or focused. The lane sets
  // where the value sits (and the gap to the floated label); the bottom padding
  // gives back the same amount so the overall height stays constant.
  const singleLineLane = theme.type.bodyLineHeight + theme.space.xxs / 2;
  const singleLineBottom = theme.space.xs - theme.space.xxs / 2;
  const singleLineMinHeight =
    singleLineLane + theme.type.bodyLineHeight + singleLineBottom;
  const hasValue = displayValue.trim().length > 0;
  const explicitPlaceholder =
    typeof rest.placeholder === "string" ? rest.placeholder : undefined;
  const hasPlaceholder = Boolean(explicitPlaceholder);
  // Multiline labels always stay at the top — no float animation needed.
  const isFloating =
    Boolean(label) && (isMultiline || isFocused || hasValue || hasPlaceholder);

  // Adopt EXTERNAL value changes (programmatic fills, form resets) into the local display, while
  // NEVER clobbering the local text with the parent's own lagging echo of what we just typed.
  useEffect(() => {
    const nextValue = String(value ?? "");
    const pending = pendingLocalValueRef.current;
    if (pending !== null) {
      // A local edit is still propagating to the parent. Its `value` arrives in lagging increments
      // (…"abcd" then "abcde"); adopting those would blink the last chars out and back in. Ignore
      // them until the parent catches up to our latest local value, then clear the guard so real
      // external changes sync again.
      if (nextValue === pending) {
        pendingLocalValueRef.current = null;
      }
      return;
    }
    if (isFocused && !syncExternalValueWhileFocused) {
      return;
    }
    setDisplayValue(nextValue);
  }, [isFocused, syncExternalValueWhileFocused, value]);

  useEffect(() => {
    Animated.timing(focusProgress, {
      duration: isFocused ? 120 : 160,
      toValue: isFocused ? 1 : 0,
      // Native: focusProgress drives only opacity → run it on the UI thread. Web keeps false
      // because there it also animates boxShadow (not native-driver compatible).
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [focusProgress, isFocused]);

  // While focused the field edits the raw value; once it loses focus it shows the
  // formatted version (currency "$1,234.56" / phone "(512) 555-0100"). Only the
  // raw value is ever committed via onChangeText, so storage stays unformatted.
  const renderedValue = isFocused
    ? displayValue
    : isCurrencyField
      ? formatFieldValueForDisplay(displayValue, fieldFormat, decimals)
      : isPhoneField
        ? formatPhoneNumber(displayValue)
        : displayValue;
  const resolvedPlaceholder = hasValue ? "" : (explicitPlaceholder ?? "");
  const resolvedReturnKeyType = nextFocusRef ? "next" : returnKeyType;

  const inputShellStyle: ViewStyle = {
    borderColor: invalid ? theme.colors.danger : theme.colors.borderStrong,
    borderWidth: theme.borderWidth.sm,
    minHeight: isMultiline ? multilineMinHeight : singleLineMinHeight,
  };

  const focusOverlayStyle: ViewStyle = {
    borderColor: invalid ? theme.colors.danger : theme.colors.focusRing,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.md,
    pointerEvents: "none",
    ...StyleSheet.absoluteFill,
  };

  if (Platform.OS === "web") {
    focusOverlayStyle.boxShadow = `0px 0px 0px 2px ${theme.colors.focusGlow}, 0px 4px 12px ${theme.colors.focusGlow}`;
  }

  const resolvedInputStyle: TextStyle = {
    backgroundColor: "transparent",
    color: theme.colors.text,
    flex: 1,
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.type.body,
    // Pin the single-line input to exactly one line so an empty field measures
    // the same height as a filled one — otherwise a native TextInput reports a
    // slightly taller empty height and the box shrinks the moment you type.
    height: isMultiline ? undefined : theme.type.bodyLineHeight,
    lineHeight: theme.type.bodyLineHeight,
    minHeight: isMultiline
      ? multilineMinHeight - theme.space.sm * 2
      : theme.type.bodyLineHeight,
    outlineWidth: Platform.OS === "web" ? 0 : undefined,
    paddingBottom: 0,
    paddingTop: 0,
    textAlignVertical: isMultiline ? "top" : "center",
  };

  return (
    <FloatingFieldShell
      caption={caption}
      className={className}
      containerStyle={containerStyle}
      disabled={!isEditable}
      errorMessage={errorMessage}
      invalid={invalid}
      isFloating={isFloating}
      label={label}
      labelInsetLeft={
        // Align the label's left edge with the value text. The text sits a few
        // px in from the shell's `px-app-xs` padding (border + the input's own
        // glyph inset), plus the leading icon and row gap when an icon is shown.
        leadingIcon
          ? theme.space.sm + (theme.type.caption + 5) + theme.space.sm
          : theme.space.sm
      }
      labelRestTop={
        // Empty + unfocused: center the placeholder in the field. Once floated
        // (focused or has a value) it animates up to `labelFloatTop`. Multiline
        // keeps its resting label at the first text line, not the box center.
        isMultiline
          ? theme.space.lg
          : theme.borderWidth.sm + (singleLineLane + singleLineBottom) / 2
      }
      labelFloatTop={Math.round(theme.space.xxs)}
    >
      {() => (
        <View className="relative">
          <View
            ref={assignContainerRef}
            className={[
              "rounded-app-sm border bg-input-background px-app-xs flex-row gap-app-sm",
              isMultiline ? "items-stretch py-app-sm" : "items-center",
              shellClassName,
            ].join(" ")}
            style={[
              inputShellStyle,
              // Show the I-beam cursor over the whole field (incl. the label
              // lane) so the chrome reads as editable text, not a button.
              Platform.OS === "web" && isEditable
                ? ({ cursor: "text" } as unknown as ViewStyle)
                : null,
              shellStyle,
              isMultiline
                ? { paddingTop: singleLineLane }
                : label
                  ? {
                      paddingTop: singleLineLane,
                      paddingBottom: singleLineBottom,
                    }
                  : {
                      paddingTop: (singleLineLane + singleLineBottom) / 2,
                      paddingBottom: (singleLineLane + singleLineBottom) / 2,
                    },
            ]}
          >
            {leadingIcon ? (
              <View className={isMultiline ? "pt-[2px]" : undefined}>
                <AppIcon
                  name={leadingIcon}
                  color={
                    isFocused ? theme.colors.focusRing : theme.colors.mutedText
                  }
                  size={theme.type.caption + 5}
                />
              </View>
            ) : null}
            <TextInput
              ref={assignInputRef}
              className={[
                "flex-1 bg-transparent font-sans text-app-body text-text py-0",
                inputClassName,
              ]
                .filter(Boolean)
                .join(" ")}
              placeholderTextColor={theme.colors.inputPlaceholder}
              placeholder={resolvedPlaceholder}
              style={[resolvedInputStyle, style, inputStyle]}
              onBlur={(event) => {
                setIsFocused(false);
                // Do NOT snap displayValue back to the parent `value` prop here: it trails typing
                // by an async render and would visibly drop the last keystroke(s) on a fast
                // type→blur. The local displayValue already holds exactly what was typed;
                // renderedValue applies the blurred-state formatting.
                onBlur?.(event);
              }}
              onChangeText={(nextValue) => {
                const sanitized = sanitizeNumericFieldValue(
                  nextValue,
                  fieldValueBehavior,
                  decimals,
                );

                pendingLocalValueRef.current = sanitized;
                setDisplayValue(sanitized);
                onChangeText?.(sanitized);
              }}
              onEndEditing={(event) => {
                // Safety net for the Android controlled-TextInput race: under JS-thread load the
                // FINAL onChangeText can be coalesced/dropped when blur lands right after a fast
                // keystroke, leaving the parent missing the tail. onEndEditing carries the input's
                // actual final text, so re-commit it — this guarantees the STORED value matches
                // what the user sees. Idempotent when onChangeText already delivered it. (Web/native
                // both fire this on blur; guard the payload in case a platform omits the text.)
                const finalText = event.nativeEvent?.text;
                if (finalText != null) {
                  const sanitized = sanitizeNumericFieldValue(
                    finalText,
                    fieldValueBehavior,
                    decimals,
                  );
                  pendingLocalValueRef.current = sanitized;
                  setDisplayValue(sanitized);
                  onChangeText?.(sanitized);
                }
                onEndEditing?.(event);
              }}
              onFocus={(event) => {
                setIsFocused(true);
                // Fresh edit session: we align display to the current committed value below, so
                // there's no in-flight local edit to protect. Clear the guard so it can't linger.
                pendingLocalValueRef.current = null;
                const next = String(value ?? "");
                // Drop display-only formatting so editing starts from the raw
                // value: "$1,234" → "1234", "(512) 555-0100" → "5125550100".
                setDisplayValue(
                  isPhoneField
                    ? next.replace(/[^\d+]/g, "")
                    : next.replace(/[$,]/g, ""),
                );
                onFocus?.(event);
              }}
              onSubmitEditing={(event) => {
                if (nextFocusRef?.current) {
                  nextFocusRef.current.focus();
                }

                onSubmitEditing?.(event);
              }}
              submitBehavior={
                isMultiline ? (nextFocusRef ? "submit" : "newline") : undefined
              }
              blurOnSubmit={!isMultiline && nextFocusRef ? false : undefined}
              returnKeyType={resolvedReturnKeyType}
              value={renderedValue}
              {...rest}
            />
            {Platform.OS !== "web" && isEditable && !isFocused ? (
              // Tap-to-focus / drag-to-scroll shim, present ONLY while the field
              // is unfocused. A raw single-line native TextInput grabs the touch
              // on finger-DOWN, so a drag that begins on an unfocused field gets
              // eaten by the input and the surrounding ScrollView never scrolls —
              // tapping a field to scroll past it instead pops the keyboard. This
              // transparent overlay sits ON TOP of the input and takes the down
              // event first: a clean tap (onPress) focuses the field, while a
              // vertical drag is yielded to the ScrollView (Pressable cedes the
              // responder on move), so the form scrolls and no focus is grabbed.
              // It is rendered BEFORE the trailing accessory, so the accessory
              // still paints on top and keeps its own taps. Once the field is
              // focused it is unmounted, handing all touches back to the input so
              // cursor placement and text selection work normally.
              <Pressable
                accessible={false}
                onPress={() => internalInputRef.current?.focus()}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {trailingAccessory ? (
              <View
                className={
                  // Single-line: center the accessory in the text row (justify-center
                  // on this column View). An accessory taller than the row — e.g. an
                  // IconButton's 44px target — pulls itself back in with negative
                  // margins; centering here keeps it on the row's vertical midline.
                  isMultiline ? "self-start" : "self-stretch justify-center"
                }
                style={{
                  marginBottom: isMultiline ? -theme.space.sm : 0,
                  marginRight: -theme.space.md,
                  marginTop: isMultiline ? -theme.space.sm : 0,
                }}
              >
                {trailingAccessory}
              </View>
            ) : null}
          </View>
          <Animated.View
            style={[
              focusOverlayStyle,
              focusOverlayStyleOverride,
              { opacity: focusProgress },
            ]}
          />
        </View>
      )}
    </FloatingFieldShell>
  );
}

// Memoized so an edit to one field in a form doesn't re-render (and re-reconcile the native
// Animated/Pressable subtree of) every OTHER field. Only helps when callers pass stable props —
// EntityFieldsSection stabilizes the per-field onChangeText/onFocus handlers and its refs; callers
// that pass fresh closures each render simply re-render as before (memo is a no-op there).
export const TextField = memo(TextFieldComponent);
