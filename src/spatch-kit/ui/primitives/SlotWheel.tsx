import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";

export type SlotItem = { label: string; value: number };

// Imperative handle: jump the wheel to a value chosen elsewhere. Does NOT fire onChange.
export type SlotWheelHandle = {
  scrollToValue: (value: number) => void;
};

type SlotWheelProps = {
  items: SlotItem[];
  // Seed position, read once on mount (uncontrolled after).
  initialValue: number;
  // Fires LIVE as the centered item changes during a scroll (not only on settle).
  onChange: (value: number) => void;
  // When true the list wraps endlessly.
  loop?: boolean;
  itemHeight?: number;
  visibleCount?: number; // odd, so one item sits dead-center
  width?: number;
  accessibilityLabel?: string;
};

const LOOP_COPIES = 3;
const DEFAULT_ITEM_HEIGHT = 36;
const DEFAULT_VISIBLE = 3;
const DEFAULT_WIDTH = 104;

// One row — plain text, memoized so a selection change re-renders ONLY the two rows whose selected
// state flipped (not the whole list). Deliberately NOT animated per-row: an earlier per-row Reanimated
// interpolation version cost hundreds of nodes and made every wheel mount take seconds.
const SlotRow = memo(function SlotRow({
  height,
  isSelected,
  label,
}: {
  height: number;
  isSelected: boolean;
  label: string;
}) {
  return (
    <View style={{ alignItems: "center", height, justifyContent: "center" }}>
      <AppText
        color={isSelected ? "text" : "mutedText"}
        numberOfLines={1}
        style={isSelected ? { fontWeight: "700" } : undefined}
        variant={isSelected ? "sectionTitle" : "body"}
      >
        {label}
      </AppText>
    </View>
  );
});

// A single-column, snapping, optionally-looping scrollable slot list — one item is always centered in a
// highlight band. Cheap to mount (plain rows + a static band); shared by TimeInput and DurationInput.
export const SlotWheel = forwardRef<SlotWheelHandle, SlotWheelProps>(
  function SlotWheel(
    {
      items,
      initialValue,
      onChange,
      loop = false,
      itemHeight = DEFAULT_ITEM_HEIGHT,
      visibleCount = DEFAULT_VISIBLE,
      width = DEFAULT_WIDTH,
      accessibilityLabel,
    },
    ref,
  ) {
    const theme = useTheme();
    const scrollRef = useRef<ScrollView>(null);
    const length = items.length;

    const initialIndex = useMemo(() => {
      const found = items.findIndex((item) => item.value === initialValue);
      return found >= 0 ? found : 0;
    }, [items, initialValue]);

    const copies = loop ? LOOP_COPIES : 1;
    const homeOffset = loop ? Math.floor(copies / 2) * length : 0;
    const rendered = useMemo(() => {
      const out: SlotItem[] = [];
      for (let c = 0; c < copies; c += 1) {
        for (let i = 0; i < length; i += 1) {
          out.push(items[i]);
        }
      }
      return out;
    }, [copies, items, length]);
    const totalCount = rendered.length;

    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const lastReported = useRef(initialValue);
    const flatIndexRef = useRef(homeOffset + initialIndex);
    const didInit = useRef(false);

    const centerPad = ((visibleCount - 1) / 2) * itemHeight;
    const containerHeight = visibleCount * itemHeight;

    const realIndexOf = useCallback(
      (flatIndex: number) => ((flatIndex % length) + length) % length,
      [length],
    );

    const scrollToFlatIndex = useCallback(
      (flatIndex: number, animated: boolean) => {
        scrollRef.current?.scrollTo({ y: flatIndex * itemHeight, animated });
      },
      [itemHeight],
    );

    const handleLayout = useCallback(
      (_event: LayoutChangeEvent) => {
        if (didInit.current) {
          return;
        }
        didInit.current = true;
        scrollToFlatIndex(flatIndexRef.current, false);
      },
      [scrollToFlatIndex],
    );

    // Live: report the centered value the instant it changes so the host updates under the finger, and
    // restyle the centered row (memoized rows keep this to two re-renders).
    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const flat = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
        flatIndexRef.current = flat;
        const real = realIndexOf(flat);
        setSelectedIndex((prev) => (prev === real ? prev : real));
        const value = items[real].value;
        if (value !== lastReported.current) {
          lastReported.current = value;
          onChange(value);
        }
      },
      [items, itemHeight, onChange, realIndexOf],
    );

    // Settle: recenter the loop to the home copy (invisible — same value).
    const settle = useCallback(
      (y: number) => {
        const flat = Math.round(y / itemHeight);
        if (loop && (flat < length || flat >= totalCount - length)) {
          const recentered = homeOffset + realIndexOf(flat);
          flatIndexRef.current = recentered;
          scrollToFlatIndex(recentered, false);
        }
      },
      [homeOffset, itemHeight, length, loop, realIndexOf, scrollToFlatIndex, totalCount],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToValue(value: number) {
          const found = items.findIndex((item) => item.value === value);
          const target = found >= 0 ? found : 0;
          lastReported.current = items[target]?.value ?? value;
          const flat = homeOffset + target;
          if (flat === flatIndexRef.current) {
            return;
          }
          flatIndexRef.current = flat;
          setSelectedIndex(target);
          scrollToFlatIndex(flat, true);
        },
      }),
      [homeOffset, items, scrollToFlatIndex],
    );

    const snapOffsets = useMemo(
      () => Array.from({ length: totalCount }, (_, i) => i * itemHeight),
      [itemHeight, totalCount],
    );

    return (
      <View style={{ height: containerHeight, width }}>
        <View
          pointerEvents="none"
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderBottomWidth: theme.borderWidth.sm,
            borderColor: theme.colors.borderStrong,
            borderRadius: 8,
            borderTopWidth: theme.borderWidth.sm,
            height: itemHeight,
            left: 0,
            position: "absolute",
            right: 0,
            top: centerPad,
          }}
        />
        <ScrollView
          ref={scrollRef}
          accessibilityLabel={accessibilityLabel}
          bounces={false}
          contentContainerStyle={{ paddingVertical: centerPad }}
          decelerationRate="fast"
          nestedScrollEnabled
          onLayout={handleLayout}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
          onScroll={handleScroll}
          onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.y)}
          overScrollMode="never"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToOffsets={snapOffsets}
        >
          {rendered.map((item, index) => (
            <SlotRow
              height={itemHeight}
              isSelected={realIndexOf(index) === selectedIndex}
              key={index}
              label={item.label}
            />
          ))}
        </ScrollView>
      </View>
    );
  },
);
