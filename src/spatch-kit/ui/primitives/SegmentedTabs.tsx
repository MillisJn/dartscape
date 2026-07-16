import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { PressableTint } from "@spatch-kit/ui/primitives/pressFeedback";

export type SegmentedTabOption<TValue extends string> = {
  icon?: IconName;
  label: string;
  value: TValue;
};

type TabLayout = {
  height: number;
  width: number;
  x: number;
};

type SegmentedTabsProps<TValue extends string> = {
  activeTabClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inactiveTabClassName?: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentedTabOption<TValue>>;
  // When true (default), a selection change smoothly scrolls the strip to bring the
  // new tab into view. Set false where the strip fades out on select (FilterTabs'
  // browse row) so no scroll motion shows through the crossfade to the filter row.
  scrollAnimated?: boolean;
  selectedValue: TValue;
  tabClassName?: string;
  tabMinHeight?: number;
  // Vertical padding utility for each tab. Defaults to none — the tight search/map
  // strip; callers can pass e.g. "py-app-xs" for taller pills.
  tabPaddingClassName?: string;
};

type SegmentedTabProps<TValue extends string> = {
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  isActive: boolean;
  onChange: (value: TValue) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  option: SegmentedTabOption<TValue>;
  tabClassName?: string;
  tabMinHeight: number;
  tabPaddingClassName: string;
};

// One tab pill. The whole selected appearance — green fill, accent border, and
// accent icon/label — CROSSFADES on/off as selection moves, rather than a single
// highlight that slides between tabs: the accent layers fade in over a static muted
// base, so the old tab fades out and the new one fades in wherever they sit. A
// single shared `fade` value drives every accent layer so they stay in lockstep.
function SegmentedTab<TValue extends string>({
  activeTabClassName,
  inactiveTabClassName,
  isActive,
  onChange,
  onLayout,
  option,
  tabClassName,
  tabMinHeight,
  tabPaddingClassName,
}: SegmentedTabProps<TValue>) {
  const theme = useTheme();
  const fade = useSharedValue(isActive ? 1 : 0);
  // First paint snaps to the initial selection (no fade); later changes crossfade.
  // Collapses to an instant swap under reduce-motion (duration.normal is 0 then).
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const duration = hasMountedRef.current ? theme.motion.duration.normal : 0;
    hasMountedRef.current = true;
    fade.value = withTiming(isActive ? 1 : 0, { duration });
  }, [isActive, fade, theme.motion.duration.normal]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const renderContent = (accent: boolean) => (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: theme.space.xs,
        justifyContent: "center",
      }}
    >
      {option.icon ? (
        <AppIcon
          color={accent ? theme.colors.accent : theme.colors.mutedText}
          name={option.icon}
          size={theme.type.label + 4}
        />
      ) : null}
      <AppText
        color={accent ? "accent" : "text"}
        style={{ letterSpacing: 0 }}
        variant="label"
      >
        {option.label}
      </AppText>
    </View>
  );

  return (
    <View onLayout={onLayout} style={{ borderRadius: theme.radius.pill }}>
      {/* Neutral outline — always present; the accent fill+border crossfades over it
          so the border color transitions rather than snapping. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderColor: theme.colors.border,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.sm,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.colors.accentMuted,
            borderColor: theme.colors.accent,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.sm,
          },
          fadeStyle,
        ]}
      />

      <PressableTint
        accessibilityLabel={option.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        // The outline + accent fill live in the overlays behind, so the pill itself
        // is borderless and transparent; overflow-hidden clips the press tint to the
        // pill's rounded corners.
        className={[
          "overflow-hidden rounded-app-pill px-app-md",
          tabPaddingClassName,
          tabClassName,
          isActive ? activeTabClassName : inactiveTabClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        hitSlop={8}
        onPress={() => onChange(option.value)}
        pressRetentionOffset={12}
        style={{
          minHeight: tabMinHeight,
          minWidth: 56,
          justifyContent: "center",
        }}
      >
        {/* Muted base label, always shown; the accent copy fades in exactly over it
            so the text/icon colour crossfades in step with the fill. */}
        {renderContent(false)}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { alignItems: "center", justifyContent: "center" },
            fadeStyle,
          ]}
        >
          {renderContent(true)}
        </Animated.View>
      </PressableTint>
    </View>
  );
}

export function SegmentedTabs<TValue extends string>({
  activeTabClassName,
  contentContainerStyle,
  containerClassName,
  containerStyle,
  inactiveTabClassName,
  onChange,
  options,
  scrollAnimated = true,
  selectedValue,
  tabClassName,
  tabMinHeight = 38,
  tabPaddingClassName = "py-0",
}: SegmentedTabsProps<TValue>) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const [tabLayouts, setTabLayouts] = useState<Record<string, TabLayout>>({});

  const selectedLayout = useMemo(
    () => tabLayouts[selectedValue],
    [selectedValue, tabLayouts],
  );

  // Bring the selected tab into view. First known position snaps into place; later
  // selections SLIDE the strip to the new tab (animated scroll) — the tabs travel,
  // the highlight does not.
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (!selectedLayout) {
      return;
    }

    const targetScrollX = Math.max(selectedLayout.x - theme.space.md, 0);
    const animated =
      scrollAnimated && hasScrolledRef.current && theme.motion.enabled;
    hasScrolledRef.current = true;

    scrollRef.current?.scrollTo({
      animated,
      x: targetScrollX,
      y: 0,
    });
  }, [scrollAnimated, selectedLayout, theme.motion.enabled, theme.space.md]);

  function handleLayout(value: TValue, event: LayoutChangeEvent) {
    const { height, width, x } = event.nativeEvent.layout;

    setTabLayouts((current) => {
      const previous = current[value];

      if (
        previous &&
        previous.width === width &&
        previous.x === x &&
        previous.height === height
      ) {
        return current;
      }

      return {
        ...current,
        [value]: { height, width, x },
      };
    });
  }

  return (
    <View
      accessibilityRole="tablist"
      className={["py-app-xs", containerClassName].filter(Boolean).join(" ")}
      style={containerStyle}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        alwaysBounceHorizontal={false}
        bounces={false}
        canCancelContentTouches={false}
        directionalLockEnabled
        disableIntervalMomentum
        contentContainerStyle={[
          {
            paddingBottom: 0,
            paddingLeft: theme.space.xs,
            paddingRight: theme.space.xs,
            paddingTop: 0,
          },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        showsHorizontalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            gap: theme.space.xs,
          }}
        >
          {options.map((option) => (
            <SegmentedTab
              activeTabClassName={activeTabClassName}
              inactiveTabClassName={inactiveTabClassName}
              isActive={option.value === selectedValue}
              key={option.value}
              onChange={onChange}
              onLayout={(event) => handleLayout(option.value, event)}
              option={option}
              tabClassName={tabClassName}
              tabMinHeight={tabMinHeight}
              tabPaddingClassName={tabPaddingClassName}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
