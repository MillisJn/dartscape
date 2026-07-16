import { memo, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";

type ToggleFieldProps = {
  caption?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  label?: string;
  // Binary only — a switch has no "unset". For tri-state (on / off / inherit) use SegmentedField or
  // SelectField with an explicit third option instead.
  onChange: (value: boolean) => void;
  value: boolean;
};

// Custom animated switch (vs RN's <Switch>) for two reasons: it can be sized to taste, and it never
// "wiggles". RN's Switch animates its thumb uncontrolled on tap, then the controlled `value` prop
// lands a render later and can fight that animation (thumb bounces back then forward). Here the thumb
// is driven SOLELY by `value` via a shared value, so a tap → onChange → new value animates exactly
// once, in one direction.
const TRACK_WIDTH = 55;
const TRACK_HEIGHT = 26;
const THUMB_SIZE = 22;
const THUMB_INSET = 3;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;
const TOGGLE_DURATION_MS = 160;

// The standard Yes/No control: a label with a switch pinned to the trailing edge, sharing the
// label/caption/error layout of SegmentedField so the two are interchangeable in settings rows.
// Memoized so an unchanged toggle doesn't re-render on every keystroke in a sibling field. The call
// site passes a stable onChange (per-field cache) so the shallow prop compare short-circuits.
export const ToggleField = memo(ToggleFieldComponent);

function ToggleFieldComponent({
  caption,
  disabled = false,
  errorMessage,
  label,
  onChange,
  value,
}: ToggleFieldProps) {
  const theme = useTheme();
  // Driven only by `value`: 1 = on, 0 = off. Starts at the correct position (no open animation),
  // then animates once per value change.
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: TOGGLE_DURATION_MS,
    });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.border, theme.colors.accent],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
  }));

  return (
    <View className="gap-app-xs">
      {/* The whole row is the tap target — label + switch — so tapping anywhere toggles. The switch
          itself is purely visual (no inner Pressable) so a tap can't double-fire. */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => onChange(!value)}
        className="flex-row items-center justify-between gap-app-md px-app-sm"
        style={disabled ? styles.disabled : undefined}
      >
        {label ? (
          <AppText
            className="flex-1"
            color={disabled ? "inputPlaceholder" : "text"}
            variant="body"
          >
            {label}
          </AppText>
        ) : null}
        <Animated.View style={[styles.track, trackStyle]}>
          <Animated.View
            style={[
              styles.thumb,
              { backgroundColor: theme.colors.accentContrast },
              thumbStyle,
            ]}
          />
        </Animated.View>
      </Pressable>
      {errorMessage ? (
        <AppText color="danger" variant="caption">
          {errorMessage}
        </AppText>
      ) : caption ? (
        <AppText variant="caption">{caption}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
    paddingHorizontal: THUMB_INSET,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    // boxShadow (both platforms) rather than `elevation`: the thumb animates translateX on toggle,
    // and an Android elevation shadow reprojects every frame of that slide — boxShadow doesn't.
    boxShadow: "0px 1px 1.5px rgba(0, 0, 0, 0.2)",
  },
});
