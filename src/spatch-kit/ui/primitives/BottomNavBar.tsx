import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import {
  PressTintOverlay,
  usePressFeedback,
} from "@spatch-kit/ui/primitives/pressFeedback";

// THE shared phone bottom navigation bar: an evenly-spaced row of icon-over-label tabs with a thin
// accent underline that jumps to the active tab, and a top hairline. Extracted from the app shell nav
// so any surface that wants that exact bar (the shell's Home/Search/Schedule/More, and the Reports
// section switcher inside the More sheet) renders the SAME component, not a look-alike.
//
// `centerSlotWidth` reserves a gap in the middle (for the shell's raised create button, drawn by the
// caller as an absolute sibling); items split evenly to its left/right and the indicator math accounts
// for the gap. Leave it 0 (default) for a plain N-item bar with no center button.

// The raised center create button's geometry. It lives HERE, next to the slot this bar reserves for it,
// because the numbers are interdependent — the slot must clear the button — and every bar with a center
// button (the app shell's, the catalog's) must share them or they drift. Callers draw the button
// themselves (as an absolute sibling) but must not re-invent these.
export const NAV_CREATE_BUTTON_SIZE = 64;
// Clearance between the button's face and the tabs either side of it. `xs`, and applied as the SAME
// value both sides — the slot is derived from it rather than hand-tuned, so the button cannot end up
// reading closer to one side than the other. Everything beyond this gap is width taken from the tabs,
// which need it more.
const NAV_CREATE_BUTTON_GAP = 8; // theme.space.xs
export const NAV_CENTER_SLOT =
  NAV_CREATE_BUTTON_SIZE + NAV_CREATE_BUTTON_GAP * 2;
// How far the button's centre sits above the bar's top edge. A small lift keeps it reading as raised
// (Meta-suite style) while sitting lower / more nestled into the bar.
export const NAV_CREATE_BUTTON_LIFT = -16;

// Standard material decelerate curve — a smooth glide, no spring overshoot.
const NAV_EASING = Easing.bezier(0.4, 0, 0.2, 1);

function animateActive(
  value: Animated.Value,
  toValue: number,
  duration: number,
  useNativeDriver: boolean,
) {
  Animated.timing(value, {
    duration,
    easing: NAV_EASING,
    toValue,
    useNativeDriver,
  }).start();
}

export type BottomNavItem = {
  // Stable React key (a route href for the shell, a section key for reports).
  key: string;
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
};

export function NavTabButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const useNativeDriver = Platform.OS !== "web";
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;
  // Press-down feedback: an accent tint that fades in/out (no scale — scale is reserved for cards).
  const {
    progress: pressProgress,
    pressHandlers,
    pressAction,
  } = usePressFeedback();

  useEffect(() => {
    animateActive(
      activeProgress,
      active ? 1 : 0,
      theme.motion.duration.normal,
      useNativeDriver,
    );
  }, [active, activeProgress, theme.motion.duration.normal, useNativeDriver]);

  const iconLift = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });
  const labelOpacity = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="flex-1 items-center justify-center py-app-xs"
      onPress={() => pressAction(onPress)}
      {...pressHandlers}
    >
      <PressTintOverlay maxOpacity={0.28} progress={pressProgress} />
      <Animated.View
        className="items-center gap-app-xxs"
        style={{
          transform: [{ translateY: iconLift }],
        }}
      >
        <AppIcon
          name={icon}
          color={active ? theme.colors.text : theme.colors.mutedText}
          size={18}
          strokeWidth={active ? 2.5 : 2}
        />
        <Animated.View style={{ opacity: labelOpacity }}>
          <AppText
            color={active ? "text" : "mutedText"}
            numberOfLines={1}
            style={
              active
                ? { fontFamily: theme.fonts.sansBold, fontWeight: "700" }
                : undefined
            }
            variant="caption"
          >
            {label}
          </AppText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function BottomNavBar({
  items,
  centerSlotWidth = 0,
}: {
  items: BottomNavItem[];
  centerSlotWidth?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const activeIndex = Math.max(
    items.findIndex((item) => item.active),
    0,
  );
  // With a center slot, items split evenly around it (the shell's two-left/two-right layout); without
  // one, all items sit in a single run.
  const splitAt =
    centerSlotWidth > 0 ? Math.ceil(items.length / 2) : items.length;
  const leftItems = items.slice(0, splitAt);
  const rightItems = items.slice(splitAt);

  const itemWidth =
    barWidth > 0 ? (barWidth - centerSlotWidth) / items.length : 0;
  // The indicator jumps straight to the active tab — no slide. Tabs past the center slot are pushed
  // right by its width.
  const indicatorX =
    activeIndex < splitAt
      ? activeIndex * itemWidth
      : activeIndex * itemWidth + centerSlotWidth;

  return (
    // This bar is always the true bottom edge of whatever screen renders it, so it owns the
    // safe-area clearance itself — otherwise Android's edge-to-edge gesture bar sits over the tabs.
    <View className="relative" style={{ paddingBottom: insets.bottom }}>
      {/* Top border drawn as an explicit line so a caller can paint an opaque element (the shell's
          raised create button) over it where it straddles the bar's top edge. */}
      <View
        pointerEvents="none"
        style={{
          backgroundColor: theme.colors.borderStrong,
          height: theme.borderWidth.sm,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />
      <View
        accessibilityRole="tablist"
        className="relative flex-row items-center justify-around"
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        {leftItems.map((item) => (
          <NavTabButton
            active={item.active}
            icon={item.icon}
            key={item.key}
            label={item.label}
            onPress={item.onPress}
          />
        ))}
        {centerSlotWidth > 0 ? (
          <View pointerEvents="none" style={{ width: centerSlotWidth }} />
        ) : null}
        {rightItems.map((item) => (
          <NavTabButton
            active={item.active}
            icon={item.icon}
            key={item.key}
            label={item.label}
            onPress={item.onPress}
          />
        ))}
        {itemWidth > 0 ? (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.pill,
              height: 3,
              left: 0,
              position: "absolute",
              top: 0,
              transform: [{ translateX: indicatorX }],
              width: itemWidth,
              zIndex: 1,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
