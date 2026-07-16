import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import type { ButtonVariant } from "@spatch-kit/ui/primitives/Button";

export type SegmentedButtonOption<TValue extends string> = {
  activeVariant?: ButtonVariant;
  inactiveVariant?: ButtonVariant;
  label: string;
  value: TValue;
};

type SegmentedButtonsProps<TValue extends string> = {
  // Names the radiogroup for screen readers (e.g. the field label "Text Scale").
  accessibilityLabel?: string;
  disabled?: boolean;
  layout?: "fill" | "scroll";
  onChange: (value: TValue) => void;
  options: Array<SegmentedButtonOption<TValue>>;
  selectedValue: TValue;
  size?: "md" | "sm";
};

export function SegmentedButtons<TValue extends string>({
  accessibilityLabel,
  disabled = false,
  layout = "fill",
  onChange,
  options,
  selectedValue,
  size = "md",
}: SegmentedButtonsProps<TValue>) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const [segmentXPositions, setSegmentXPositions] = useState<
    Record<string, number>
  >({});

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );

  // One opacity/scale pair per option. This can't be a frozen snapshot of the first render: a single
  // SegmentedButtons instance is reused across renders with different `options` (e.g. the Setup
  // screen swaps game kinds, so the same element position gets a longer/shorter option list). If the
  // array stayed at its original length, `animatedValues[index]` would be undefined for new indices
  // and reading `.opacity` off it would throw. So we resize in place when the count changes, keeping
  // existing Animated.Values so an in-flight transition isn't dropped.
  const animatedValuesRef = useRef<
    Array<{ opacity: Animated.Value; scale: Animated.Value }>
  >([]);
  if (animatedValuesRef.current.length !== options.length) {
    const prev = animatedValuesRef.current;
    animatedValuesRef.current = options.map(
      (_, i) =>
        prev[i] ?? {
          opacity: new Animated.Value(i === selectedIndex ? 1 : 0),
          scale: new Animated.Value(i === selectedIndex ? 1 : 0.92),
        },
    );
  }
  const animatedValues = animatedValuesRef.current;

  const prevSelectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    const prev = prevSelectedIndexRef.current;
    if (prev === selectedIndex) return;
    if (!animatedValues[prev] || !animatedValues[selectedIndex]) return;

    const duration =
      theme.motion.preference === "reduced" ? 0 : theme.motion.duration.normal;
    const outDuration = Math.round(duration * 0.7);
    const useNativeDriver = Platform.OS !== "web";

    Animated.parallel([
      Animated.timing(animatedValues[prev].opacity, {
        toValue: 0,
        duration: outDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(animatedValues[prev].scale, {
        toValue: 0.92,
        duration: outDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(animatedValues[selectedIndex].opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(animatedValues[selectedIndex].scale, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
    ]).start();

    prevSelectedIndexRef.current = selectedIndex;
  }, [
    selectedIndex,
    animatedValues,
    theme.motion.preference,
    theme.motion.duration.normal,
  ]);

  useEffect(() => {
    if (layout !== "scroll") return;

    const x = segmentXPositions[String(selectedValue)];
    if (!Number.isFinite(x)) return;

    const scrollPadding = 16;
    scrollRef.current?.scrollTo({
      animated: theme.motion.preference !== "reduced",
      x: Math.max(x - scrollPadding, 0),
      y: 0,
    });
  }, [layout, segmentXPositions, selectedValue, theme.motion.preference]);

  const segmentClassName = [
    "items-center justify-center",
    layout === "fill" ? "flex-1" : "",
    size === "sm"
      ? "min-h-[40px] px-app-sm py-app-xs"
      : "min-h-[50px] px-app-md py-app-sm",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // Single-select group → radiogroup + radio items (matches ThemeControls). Screen readers announce
    // "radio button, selected"; each item is Tab-focusable + Enter/Space activatable. Full arrow-key
    // roving is NOT implemented (an RN-Web limitation) and is intentionally out of scope here.
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      className={[
        "w-full overflow-hidden rounded-app-sm border border-border-strong bg-surface",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      {layout === "fill" ? (
        <View className="flex-row items-stretch">
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;

            return (
              <Pressable
                key={option.value}
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled }}
                className={[
                  segmentClassName,
                  index > 0 ? "border-l border-border-strong" : "",
                  disabled ? "opacity-100" : "active:opacity-90",
                ].join(" ")}
                disabled={disabled}
                onPress={() => onChange(option.value)}
              >
                <Animated.View
                  className="absolute inset-0 bg-accent"
                  pointerEvents="none"
                  style={{
                    opacity: animatedValues[index].opacity,
                    transform: [{ scale: animatedValues[index].scale }],
                  }}
                />
                <AppText
                  className="text-center"
                  color={isSelected ? "accentContrast" : "accent"}
                  numberOfLines={1}
                  variant="label"
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ScrollView
          horizontal
          ref={(node) => {
            scrollRef.current = node;
          }}
          showsHorizontalScrollIndicator={false}
        >
          <View className="flex-row items-stretch">
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected: isSelected }}
                  className={[
                    segmentClassName,
                    index > 0 ? "border-l border-border-strong" : "",
                    disabled ? "opacity-100" : "active:opacity-90",
                  ].join(" ")}
                  disabled={disabled}
                  onLayout={(event) => {
                    const x = event.nativeEvent.layout.x;
                    if (Number.isFinite(x)) {
                      setSegmentXPositions((prev) => {
                        if (prev[String(option.value)] === x) return prev;
                        return { ...prev, [String(option.value)]: x };
                      });
                    }
                  }}
                  onPress={() => onChange(option.value)}
                >
                  <Animated.View
                    className="absolute inset-0 bg-accent"
                    pointerEvents="none"
                    style={{
                      opacity: animatedValues[index].opacity,
                      transform: [{ scale: animatedValues[index].scale }],
                    }}
                  />
                  <AppText
                    className="text-center"
                    color={isSelected ? "accentContrast" : "accent"}
                    numberOfLines={1}
                    variant="label"
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
