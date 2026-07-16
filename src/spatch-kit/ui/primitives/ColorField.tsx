import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { ButtonSurface } from "@spatch-kit/ui/primitives/Button";
import { ColorSwatch } from "@spatch-kit/ui/primitives/ColorSwatch";
import { DEFAULT_COLOR_PALETTE, normalizeHexColor } from "@spatch-kit/theme/colorPalette";
import { FloatingFieldShell } from "@spatch-kit/ui/primitives/FloatingFieldShell";
import { PopupSurface } from "@spatch-kit/ui/primitives/PopupSurface";

type ColorFieldProps = {
  // When false, omits the leading "no color" cell so a value is always required
  // (used by the theme primary-color picker, where the accent can't be empty).
  allowClear?: boolean;
  caption?: string;
  disabled?: boolean;
  // When true, each swatch tap applies immediately so the surrounding UI updates
  // live as you browse. Cancel or dismissing the popup reverts to the color that
  // was active when it opened; only Save keeps the change. Used by the theme
  // primary-color picker (its "Apply" button reads "Save" in this mode).
  livePreview?: boolean;
  errorMessage?: string | null;
  label?: string;
  onChange: (value: string) => void;
  // Optional swatch override; falls back to the shared default palette.
  palette?: string[];
  value: string;
};

// 5 columns × 4 rows = 20 cells (one leading "no color" cell + 19 swatches).
const GRID_COLUMNS = 5;
const SWATCH_SIZE = 30;

// Sentinel for the "no color / default" grid cell so it can sit in the same
// selection model as the hex swatches without colliding with a real value.
const NO_COLOR = "";

// White circle with a red diagonal line — the "no color / default" indicator.
function NoColorIndicator({ size = SWATCH_SIZE }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      className="items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "#ffffff",
        borderColor: theme.colors.borderStrong,
        borderRadius: size / 2,
        borderWidth: theme.borderWidth.sm,
        height: size,
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: "#ef4444",
          height: 2,
          transform: [{ rotate: "-45deg" }],
          width: size * 1.4,
        }}
      />
    </View>
  );
}

type GridCell = { key: string; value: string; kind: "none" | "color" };

// One grid cell with a selection ring that "pops in" on select — mirrors the
// SegmentedButtons indicator (opacity 0→1, scale-up, ease-out cubic).
function SwatchCell({
  cell,
  selected,
  onSelect,
}: {
  cell: GridCell;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const ringSize = SWATCH_SIZE + 12;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration:
        theme.motion.preference === "reduced"
          ? 0
          : theme.motion.duration.normal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [
    selected,
    progress,
    theme.motion.preference,
    theme.motion.duration.normal,
  ]);

  return (
    <View
      className="items-center py-app-sm"
      style={{ width: `${100 / GRID_COLUMNS}%` }}
    >
      <Pressable
        accessibilityLabel={
          cell.kind === "none" ? "No color" : `Color ${cell.value}`
        }
        onPress={onSelect}
        className="items-center justify-center active:opacity-80"
        style={{ height: ringSize, width: ringSize }}
      >
        <Animated.View
          pointerEvents="none"
          className="absolute"
          style={{
            borderColor: theme.colors.accent,
            borderRadius: 999,
            borderWidth: theme.borderWidth.md,
            height: ringSize,
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
            width: ringSize,
          }}
        />
        {cell.kind === "none" ? (
          <NoColorIndicator />
        ) : (
          <ColorSwatch color={cell.value} size={SWATCH_SIZE} />
        )}
      </Pressable>
    </View>
  );
}

// Memoized so an unchanged color field doesn't re-render on every keystroke in a sibling field. The
// call site passes a stable onChange for the shallow compare to bite.
export const ColorField = memo(ColorFieldComponent);

function ColorFieldComponent({
  allowClear = true,
  caption,
  disabled = false,
  errorMessage,
  label,
  livePreview = false,
  onChange,
  palette,
  value,
}: ColorFieldProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<View | null>(null);
  // The committed color captured when the popup opened. Live preview applies
  // selections immediately; Cancel/dismiss restores this snapshot.
  const openSnapshotRef = useRef<string>(value);

  const normalizedValue = normalizeHexColor(value);

  const swatches = useMemo(() => {
    const base = palette?.length ? palette : DEFAULT_COLOR_PALETTE;
    // Normalize so selection comparisons are exact and drop any unparseable or
    // duplicate entries an override might contain.
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of base) {
      const hex = normalizeHexColor(entry);
      if (hex && !seen.has(hex)) {
        seen.add(hex);
        result.push(hex);
      }
    }
    return result;
  }, [palette]);

  // Selection is staged in a draft and only committed on Apply (Cancel discards).
  // Re-seed from the committed value each time the popup opens.
  const [draft, setDraft] = useState<string>(normalizedValue ?? NO_COLOR);
  useEffect(() => {
    if (isOpen) {
      setDraft(normalizedValue ?? NO_COLOR);
    }
  }, [isOpen, normalizedValue]);

  // Optional leading "no color" cell + the swatches, as one flat list of cells.
  const cells: GridCell[] = [
    ...(allowClear
      ? [{ key: "__none__", kind: "none" as const, value: NO_COLOR }]
      : []),
    ...swatches.map((hex) => ({
      key: hex,
      kind: "color" as const,
      value: hex,
    })),
  ];

  function openPicker() {
    openSnapshotRef.current = value;
    setIsOpen(true);
  }

  function selectCell(next: string) {
    setDraft(next);
    // Live mode applies each tap so the surrounding UI previews it. Staged mode
    // only updates the draft until Apply.
    if (livePreview) {
      onChange(next);
    }
  }

  // Cancel button + any dismissal (backdrop tap, back button). In live mode the
  // preview has already mutated the value, so restore the opening snapshot.
  function cancel() {
    if (livePreview) {
      onChange(openSnapshotRef.current);
    }
    setIsOpen(false);
  }

  function apply() {
    onChange(draft);
    setIsOpen(false);
  }

  return (
    <>
      <FloatingFieldShell
        caption={caption}
        disabled={disabled}
        errorMessage={errorMessage}
        label={label}
        labelMode="static"
      >
        {({ contentPaddingTop }) => (
          <View ref={triggerRef}>
            <Pressable
              disabled={disabled}
              onPress={() => (isOpen ? cancel() : openPicker())}
              className={[
                "rounded-app-sm bg-input-background px-app-md py-app-sm",
                disabled ? "opacity-50" : "active:opacity-90",
              ].join(" ")}
              style={{
                borderColor: theme.colors.borderStrong,
                borderWidth: theme.borderWidth.sm,
                paddingTop: contentPaddingTop,
              }}
            >
              <View className="flex-row items-center gap-app-sm">
                {normalizedValue ? (
                  <ColorSwatch color={normalizedValue} size={20} />
                ) : (
                  <NoColorIndicator size={20} />
                )}
                <View className="flex-1">
                  <AppText
                    color={normalizedValue ? "text" : "mutedText"}
                    variant="body"
                  >
                    {normalizedValue ?? "Default"}
                  </AppText>
                </View>
                <AppIcon
                  name={isOpen ? "chevronUp" : "chevronDown"}
                  size={theme.type.caption + 5}
                />
              </View>
            </Pressable>
          </View>
        )}
      </FloatingFieldShell>

      <PopupSurface
        anchorRef={triggerRef}
        maxWidth={380}
        minHeight={0}
        minWidth={Math.min(320, 240 + theme.space.xl)}
        onClose={cancel}
        padding="lg"
        presentation="centered"
        visible={isOpen}
      >
        <View className="gap-app-lg">
          <AppText variant="sectionTitle">Select Color</AppText>

          <View className="flex-row flex-wrap">
            {cells.map((cell) => (
              <SwatchCell
                key={cell.key}
                cell={cell}
                selected={cell.value === draft}
                onSelect={() => selectCell(cell.value)}
              />
            ))}
          </View>

          <View className="flex-row gap-app-sm">
            <ButtonSurface
              className="flex-1"
              onPress={cancel}
              variant="secondary"
            >
              Cancel
            </ButtonSurface>
            <ButtonSurface
              className="flex-1"
              onPress={apply}
              showShellOutline
              variant="primary"
            >
              {livePreview ? "Save" : "Apply"}
            </ButtonSurface>
          </View>
        </View>
      </PopupSurface>
    </>
  );
}
