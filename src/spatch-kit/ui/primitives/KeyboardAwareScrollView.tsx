import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type ScrollViewProps,
} from "react-native";
import Animated from "react-native-reanimated";

import { useKeyboardInsetCollapse } from "@spatch-kit/hooks/useKeyboardInsetCollapse";
import { useKeyboardOwnedByHigherOverlay } from "@spatch-kit/ui/overlays/core/dismissal";
import { useOverlayLayerId } from "@spatch-kit/ui/overlays/core/overlayLayerContext";
import { useSurfaceEnter } from "@spatch-kit/ui/overlays/core/surfaceEnterContext";
import { deferPastCommit } from "@spatch-kit/ui/utils/deferPastCommit";
import { useTheme } from "@spatch-kit/theme/provider";

// TextInput host instances expose measureInWindow at runtime; the RN type doesn't declare it.
type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

// A drop-in ScrollView that keeps the FOCUSED field visible above the soft keyboard, for any
// scrollable form — modal sheets (creators/editors) AND routed screens (settings, detail). The app is
// edge-to-edge, so Android's native adjustResize does NOT scroll a covered field into view; this does
// it in JS: on keyboard-open it scrolls the focused field up to a fixed gap above the keyboard in ONE
// motion, reserving keyboard-height + gap of extra room (a bottom spacer, ADDED to whatever bottom
// padding the caller already has) to scroll into. Only scrolls UP, only when the field is below the
// target line. No-op on web (keyboard doesn't overlay).
//
// The reserved bottom room is driven by useKeyboardInsetCollapse, so it collapses on the UI thread the
// instant a drag begins (before keyboardDidHide lands) — a form at its bottom can't be dragged into
// the empty space that spacer is holding as the keyboard dismisses.
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView({ children, ...rest }, forwardedRef) {
    const theme = useTheme();
    const scrollRef = useRef<ScrollView | null>(null);
    const setRef = (node: ScrollView | null) => {
      scrollRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Ignore the keyboard when a HIGHER overlay owns it: the keyboard belongs to the topmost interactive
    // overlay (e.g. a collection-editor popup), so a form sitting behind it — a screen, OR a lower
    // overlay like the settings inside the More sheet — must not react, else it scrolls the wrong
    // (background) form to the popup's focused field. The scroll view inside the topmost overlay (or a
    // plain screen with nothing open) keeps reacting. Read via a ref so the keyboard listener (a stable
    // closure) always sees the current value.
    const myLayerId = useOverlayLayerId();
    const keyboardOwnedElsewhere = useKeyboardOwnedByHigherOverlay(myLayerId);
    const suppressRef = useRef(false);
    suppressRef.current = keyboardOwnedElsewhere;

    // "Has the sheet hosting this scroll view finished sliding in?" — the gate on measuring anything
    // (see the listener below). Always entered inside a plain screen.
    const surfaceEnter = useSurfaceEnter();

    // How far above the keyboard the focused field ends up.
    const lift = theme.space.md * 3;
    const { scrollHandler, spacerStyle, offset } = useKeyboardInsetCollapse(
      keyboardHeight > 0 ? keyboardHeight + lift : 0,
    );

    useEffect(() => {
      const showEvent =
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const hideEvent =
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

      // A pending scroll — waiting on the host sheet's enter, then on a paint — is cancelled by the
      // next keyboard event and on unmount, so a stale one never lands on a torn-down form.
      let cancelEnterWait: (() => void) | null = null;
      let cancelFrames: (() => void) | null = null;
      const cancelPendingScroll = () => {
        cancelEnterWait?.();
        cancelFrames?.();
        cancelEnterWait = null;
        cancelFrames = null;
      };

      const showSub = Keyboard.addListener(showEvent, (event) => {
        // A screen behind an open overlay ignores the keyboard entirely (see suppressRef) — no inset,
        // no scroll — so it never reacts to the overlay's focused input.
        if (suppressRef.current) {
          return;
        }
        const windowHeight = Dimensions.get("window").height;
        const keyboardTop = Math.min(
          windowHeight,
          event.endCoordinates.screenY ||
            windowHeight - event.endCoordinates.height,
        );
        setKeyboardHeight(event.endCoordinates.height);

        const scrollFocusedAboveKeyboard = () => {
          const focused = TextInput.State.currentlyFocusedInput?.() as unknown as
            | Measurable
            | null;
          focused?.measureInWindow?.((_x, fieldY, _w, fieldHeight) => {
            const scrollUpBy = fieldY + fieldHeight - (keyboardTop - lift);
            if (scrollUpBy > 1) {
              scrollRef.current?.scrollTo({
                y: Math.max(0, offset.value + scrollUpBy),
                animated: true,
              });
            }
          });
        };

        // Measure ONLY once the host sheet has finished sliding in. A creator/editor popup opens as a
        // slide-up sheet and can raise the keyboard WITH it, so the keyboard may report shown while
        // this scroll view is still riding off-screen below — measuring then reads the field near the
        // bottom of the screen and scrolls the form to its bottom for no visible reason once the sheet
        // settles. `whenEntered` fires immediately inside a screen (or an already-open sheet), so an
        // ordinary tap-a-field scroll is unchanged. See surfaceEnterContext.
        cancelPendingScroll();
        cancelEnterWait = surfaceEnter.whenEntered(() => {
          // One paint past the enter: the settled position lands natively a beat before it's
          // committed back, so measuring on the callback itself can still read the sheet mid-flight.
          cancelFrames = deferPastCommit(scrollFocusedAboveKeyboard);
        });
      });
      const hideSub = Keyboard.addListener(hideEvent, () => {
        // Drop any scroll still waiting on the enter: the keyboard it was going to clear is gone.
        cancelPendingScroll();
        setKeyboardHeight(0);
      });

      return () => {
        cancelPendingScroll();
        showSub.remove();
        hideSub.remove();
      };
    }, [lift, offset, surfaceEnter]);

    return (
      <Animated.ScrollView
        ref={setRef}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        {...rest}
        // After {...rest} so the UI-thread handler always wins (no caller passes onScroll today).
        onScroll={scrollHandler}
      >
        {children}
        {/* Extra room to scroll the focused field above the keyboard — ADDED below the caller's own
            content/padding (so it never fights the caller's contentContainerStyle), off-screen, and
            collapsed on the UI thread the instant a drag begins. */}
        <Animated.View style={spacerStyle} />
      </Animated.ScrollView>
    );
  },
);
