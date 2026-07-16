import { useEffect } from "react";
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

// Shared UI-thread machinery for a scroll view that reserves a bottom inset while the keyboard is up
// (room to scroll the focused field above the keyboard) and must DROP that inset the instant a drag
// begins. Holding the reserved room in React state means it only collapses a couple of frames after
// the drag starts — long enough that a form scrolled to its bottom scrolls into the empty reserved
// space as the keyboard dismisses (a phantom scroll + end-of-scroll "click"). Here the inset lives in
// a shared value zeroed by an onBeginDrag WORKLET, so it's gone on the FIRST frame of the drag with no
// JS round-trip. Growth (on keyboard show) stays JS-timed — only the collapse has to be instant.
//
// `targetInset` is the reserved height for the CURRENT keyboard state (0 when hidden). Returns:
//  • `scrollHandler` — put on an Animated.ScrollView's `onScroll` (needs scrollEventThrottle).
//  • `spacerStyle`   — drives an Animated.View rendered as the LAST child of the scroll content.
//  • `offset`        — the live scroll position, mirrored for JS-side scrollTo math (read `.value`).
export function useKeyboardInsetCollapse(targetInset: number) {
  const inset = useSharedValue(0);
  const offset = useSharedValue(0);

  // Grow / reset the reserved room as the keyboard shows and hides. A drag zeroes `inset` first via
  // the worklet below; that's fine — the next keyboard event (or re-focus) sets it again from here.
  useEffect(() => {
    inset.value = targetInset;
  }, [inset, targetInset]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.y;
    },
    onBeginDrag: () => {
      // First frame of the drag, on the UI thread: drop the reserved inset before the scroll can
      // enter it. keyboardDismissMode="on-drag" dismisses the keyboard on this same gesture.
      inset.value = 0;
    },
  });

  const spacerStyle = useAnimatedStyle(() => ({ height: inset.value }));

  return { scrollHandler, spacerStyle, offset };
}
