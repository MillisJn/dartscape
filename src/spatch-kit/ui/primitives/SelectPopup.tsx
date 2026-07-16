import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { useKeyboardHeight } from "@spatch-kit/hooks/useKeyboardHeight";
import { useTheme } from "@spatch-kit/theme/provider";
import { useOverlayRegistration } from "@spatch-kit/ui/overlays/core/dismissal";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { DropdownSurface } from "@spatch-kit/ui/primitives/DropdownSurface";
import { PressableTint } from "@spatch-kit/ui/primitives/pressFeedback";
import { PopupSurface } from "@spatch-kit/ui/primitives/PopupSurface";
import { TextField } from "@spatch-kit/ui/primitives/TextField";

export type SelectOption = {
  // Optional glyph shown at the start of the option row.
  icon?: IconName;
  label: string;
  value: string;
};

type SelectPopupProps = {
  // When true, the list shows a "Custom…" field (above "Clear selection") for typing a value not in
  // `options` (free text).
  allowCustomValue?: boolean;
  // The trigger to anchor the desktop dropdown under. Ignored by the phone (centered) presentation,
  // so a caller with no visible trigger (e.g. the shell's + button) can pass a detached ref.
  anchorRef: RefObject<View | null>;
  clearable?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  options: SelectOption[];
  // Phone only: present the option list as a titled partial bottom sheet (AppModal `bottomSheet`) that
  // slides up from the bottom edge, instead of the centered PopupSurface — for a menu-style picker (the
  // shell's "+" quick-create) that reads as an action list rather than a field dropdown. On desktop it
  // still drops down under the anchor. Defaults to false. Pair with `sheetTitle`/`sheetIcon` for the
  // header. Not for field-anchored selects, which keep the centered popup.
  sheet?: boolean;
  sheetIcon?: IconName;
  sheetTitle?: string;
  value: string;
  visible: boolean;
};

// The select popup — the list-of-options surface shared by SelectField and any other control that
// wants the exact same picker (e.g. the shell's raised + button). On a wide screen it drops down
// anchored under the trigger; on a phone it's a centered popup over a scrim. Split out of SelectField
// so both the field and a bare trigger open the identical popup.
export function SelectPopup({
  allowCustomValue = false,
  anchorRef,
  clearable = true,
  onChange,
  onClose,
  options,
  sheet = false,
  sheetIcon,
  sheetTitle = "Select",
  value,
  visible,
}: SelectPopupProps) {
  const theme = useTheme();
  const { height: keyboardHeight } = useKeyboardHeight();
  const { width: windowWidth } = useWindowDimensions();
  // Wide screen (desktop web OR a large native tablet): drop down anchored under the field like a
  // desktop select. It's a WIDTH decision, not a web-only one — only phones (narrow) keep the
  // centered popup, which needs the room a small screen can't give a hanging dropdown.
  const isDesktop = windowWidth >= 768;
  const [customDraft, setCustomDraft] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);
  // When the list opens, park the selected option in the MIDDLE of the viewport (so a long,
  // scrollable list opens showing the current value in context, not scrolled to the top). Rows are a
  // uniform height, so offset = index * rowHeight; we measure that row height + the viewport height
  // from onLayout, then scroll once both are known. `didCenterRef` keeps it to once per open.
  const rowHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const didCenterRef = useRef(false);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const centerSelected = () => {
    const rowHeight = rowHeightRef.current;
    const viewport = viewportHeightRef.current;
    if (didCenterRef.current || selectedIndex < 0 || !rowHeight || !viewport) {
      return;
    }
    didCenterRef.current = true;
    const target = selectedIndex * rowHeight - (viewport - rowHeight) / 2;
    scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false });
  };
  // The anchored dropdown (AnchoredOverlay) doesn't self-register for single-active dismissal, so
  // register its open state here; the centered PopupSurface path registers itself.
  useOverlayRegistration(isDesktop && visible, onClose);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  // A value present but not in `options` is a custom (free-text) value.
  const isCustomValue = allowCustomValue && !!value && !selectedOption;

  function commitCustom() {
    const trimmed = customDraft.trim();
    if (!trimmed) {
      return;
    }
    // Typing an existing option's label/value normalizes to its canonical value.
    const match = options.find(
      (option) =>
        option.label.toLowerCase() === trimmed.toLowerCase() ||
        option.value.toLowerCase() === trimmed.toLowerCase(),
    );
    onChange(match ? match.value : trimmed);
    onClose();
  }

  // Each time the popup opens, seed the custom field with the current custom
  // value (so it's editable) or clear it back to the "Custom" placeholder.
  useEffect(() => {
    if (visible) {
      setCustomDraft(isCustomValue ? value : "");
    } else {
      // Re-arm centering for the next open (the list remounts, so its measurements do too).
      didCenterRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The keyboard only opens here when the custom field (the last row) is focused.
  // As the popup shrinks above the keyboard the list's bottom slips out of view,
  // so re-pin it to the end — after the shrink settles — to keep the field visible.
  useEffect(() => {
    if (!visible || keyboardHeight <= 0 || !allowCustomValue) {
      return;
    }
    const handle = requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => cancelAnimationFrame(handle);
  }, [visible, keyboardHeight, allowCustomValue]);

  const showsClearRow = clearable && !!value;
  // The last option drops its divider only when nothing follows it.
  const hasTrailingContent = showsClearRow || allowCustomValue;

  // The option list — shared by both presentations. Direct child of the surface (no extra wrapper
  // View): a plain View has flex-shrink:0 on web, which would grow past the surface's maxHeight and
  // get clipped instead of scrolling. FormSurface already clips the rounded corners, so the wrapper
  // is unnecessary.
  const optionList = (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onLayout={(event) => {
        viewportHeightRef.current = event.nativeEvent.layout.height;
        centerSelected();
      }}
    >
      {options.map((item, index) => {
        const isSelected = item.value === value;
        const isLastOption = index === options.length - 1;
        const showsBottomBorder = hasTrailingContent || !isLastOption;

        return (
          <PressableTint
            key={item.value}
            onPress={() => {
              onChange(item.value);
              onClose();
            }}
            className={
              isSelected ? "bg-accent-muted" : "hover:bg-accent-muted/70"
            }
          >
            <View
              className={[
                "flex-row items-center justify-between px-app-md py-app-lg",
                showsBottomBorder ? "border-b border-border" : "border-b-0",
              ].join(" ")}
              onLayout={
                isSelected
                  ? (event) => {
                      rowHeightRef.current = event.nativeEvent.layout.height;
                      centerSelected();
                    }
                  : undefined
              }
            >
              <View className="flex-1 flex-row items-center gap-app-md">
                {item.icon ? (
                  <AppIcon
                    color={isSelected ? theme.colors.accent : theme.colors.text}
                    name={item.icon}
                    size={theme.type.label}
                  />
                ) : null}
                <AppText
                  color={isSelected ? "accent" : "text"}
                  variant="option"
                  // The `option` variant carries letterSpacing (tracking-[0.01em]).
                  // On Android that trailing letter-spacing is added AFTER the last
                  // glyph but NOT reserved in the Text's measured/clip width, so a
                  // word whose advance lands just over a pixel boundary gets its
                  // final glyph clipped (e.g. "Task" losing its "k") — word-specific
                  // and intermittent as the row's subpixel origin shifts per open. A
                  // few px of trailing room widens the clip box past the letterSpacing
                  // so the last glyph always paints. Absorbed by the flex-1 row cell.
                  style={{ paddingRight: 4 }}
                >
                  {item.label}
                </AppText>
              </View>
              {isSelected ? (
                <AppText color="accent" variant="option">
                  Selected
                </AppText>
              ) : null}
            </View>
          </PressableTint>
        );
      })}

      {allowCustomValue ? (
        <View className="flex-row items-stretch gap-app-sm px-app-md py-app-md">
          {/* flex-1 lives on a plain View — NativeWind's styled() wrapper on
              FloatingFieldShell doesn't reliably forward `className` to a flex
              node, so the field wouldn't grow if flex-1 were set on TextField. */}
          <View className="flex-1">
            <TextField
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCustomDraft}
              onSubmitEditing={commitCustom}
              placeholder="Custom"
              returnKeyType="done"
              value={customDraft}
            />
          </View>
          {/* items-stretch (row) + aspect-square = a square button the same
              height as the field. */}
          <Pressable
            accessibilityLabel="Save custom value"
            accessibilityRole="button"
            disabled={customDraft.trim().length === 0}
            hitSlop={8}
            onPress={commitCustom}
            className="aspect-square items-center justify-center rounded-app-sm bg-accent active:opacity-90"
            style={
              customDraft.trim().length === 0 ? { opacity: 0.4 } : undefined
            }
          >
            <AppIcon
              name="selected"
              color={theme.colors.accentContrast}
              size={theme.type.body}
            />
          </Pressable>
        </View>
      ) : null}

      {showsClearRow ? (
        <Pressable
          onPress={() => {
            onChange("");
            onClose();
          }}
          className="hover:bg-accent-muted/70 active:bg-accent-muted/80 active:opacity-95"
        >
          <View
            className={[
              "px-app-md py-app-lg",
              allowCustomValue ? "border-t border-border" : "",
            ].join(" ")}
          >
            <AppText color="accent" variant="option">
              Clear selection
            </AppText>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <DropdownSurface
        anchorRef={anchorRef}
        maxHeight={360}
        onClose={onClose}
        visible={visible}
      >
        {optionList}
      </DropdownSurface>
    );
  }

  // Phone bottom-sheet presentation: the same option list, hosted in a titled partial sheet that slides
  // up from the bottom edge (icon + title flushed left, like every other popup). `centered` governs the
  // wide-web fallback width; on a phone `bottomSheet` takes precedence and slides.
  if (sheet) {
    return (
      <AppModal
        bottomSheet
        centered
        headerLeadingAccessory={
          sheetIcon ? <AppIcon alignText name={sheetIcon} size={18} /> : undefined
        }
        headerTitleAlign="left"
        onClose={onClose}
        title={sheetTitle}
        visible={visible}
      >
        {optionList}
      </AppModal>
    );
  }

  return (
    <PopupSurface
      anchorRef={anchorRef}
      maxHeight={520}
      maxWidth={420}
      minHeight={0}
      minWidth={Math.min(320, 240 + theme.space.xl)}
      onClose={onClose}
      padding="none"
      presentation="centered"
      visible={visible}
    >
      {optionList}
    </PopupSurface>
  );
}
