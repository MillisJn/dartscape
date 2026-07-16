import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

type KeyboardMetrics = {
  // Keyboard height in px (0 when hidden).
  height: number;
  // Absolute Y of the keyboard's top edge on screen (0 when hidden). Robust to window-resize
  // (adjustResize) — pair with min(windowHeight, screenY) to find the usable bottom regardless of
  // whether the host window already shrank.
  screenY: number;
};

const HIDDEN: KeyboardMetrics = { height: 0, screenY: 0 };

// Live keyboard metrics. More reliable than KeyboardAvoidingView inside a native Modal/overlay,
// where the avoid-view often doesn't receive the resize. Use the metrics to manually lift
// floating content above the keyboard.
//
// `enabled` (default true): pass false to NOT subscribe and always report HIDDEN. Surfaces that
// ignore the keyboard (e.g. a full-screen modal that freezes its height and never lifts) pass false
// so a keyboard show/hide/dismiss doesn't re-render them — critical while an overlay is animating
// open on the native driver, where any re-render of the animating tree stalls the animation.
export function useKeyboardHeight(enabled = true): KeyboardMetrics {
  const [metrics, setMetrics] = useState<KeyboardMetrics>(HIDDEN);

  useEffect(() => {
    if (!enabled) {
      // Ensure we don't hold a stale non-hidden value if a consumer toggles enabled off.
      setMetrics(HIDDEN);
      return;
    }
    // iOS fires the *Will* events (smoother, ahead of the animation); Android only the *Did*.
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const end = event.endCoordinates;
      setMetrics({
        height: end?.height ?? 0,
        screenY: end?.screenY ?? 0,
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setMetrics(HIDDEN));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  return metrics;
}
