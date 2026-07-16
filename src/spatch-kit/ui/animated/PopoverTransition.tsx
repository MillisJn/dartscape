// Reusable enter/exit transition for overlay panels (assistant popover, toasts, etc.).
// Fades and spring-scales in on show; shrinks and fades out on hide. Keeps children
// mounted through the exit animation so there is no abrupt pop on dismiss.
//
// ─── OVERLAY FADE INVARIANTS — DO NOT REGRESS ──────────────────────────────────────────────────
// Every popup/overlay fade in the app (menus, alerts, modals, popovers, toasts) must follow these.
// All four were hard-won on native Android (Fabric / New Architecture) and are easy to break:
//
// 1. DRIVER IS PER-PLATFORM: `useNativeDriver = Platform.OS !== "web"`. NOT "JS everywhere".
//    • native: opacity/scale run on the UI thread → the ENTER fade stays smooth even while the
//      overlay's content is still mounting on the JS thread. A JS-driven entrance skips frames
//      there and "clicks in".
//    • web: react-native-web SNAPS native-driven animations instead of tweening. (That is what the
//      DataTable / pressMotion `useNativeDriver:false` comments are about — a WEB reason; DataTable
//      is desktop-only. Do NOT generalize them to native.)
//
// 2. START THE ENTER ANIMATION ONLY AFTER THE VIEW IS COMMITTED — never in the same effect that
//    first mounts it. On the native driver the animation runs the instant `.start()` is called; if
//    the Animated.View doesn't exist yet, the fade finishes before it mounts → it pops/clicks in.
//    So: mount at opacity 0 in one effect (`setRendered(true)`), then run the fade in a SEPARATE
//    effect gated on `rendered && visible`. Do NOT `setValue(0)` before that fade — the view already
//    mounted at 0, and forcing 0 makes a mount-already-open consumer snap-then-fade.
//
// 3. GATE THE ENTRANCE ON A `ready` FLAG driven by the portal's onShow (web sets it via an effect),
//    so the transition stays hidden until the portal has actually presented. See AppAlertHost /
//    AccountMenu / FloatingActionMenu.
//
// 4. GUARD A SPURIOUS EXIT (`hasEnteredRef`): first mount in the hidden state runs the lifecycle
//    effect with visible=false; without the guard it plays an exit and fires onExitComplete for
//    something that never opened, unmounting the overlay for a frame ("flashes off").
//
// Also: animated opacity must live on a RAW Animated.View — never routed through a nativewind
// styled() surface (FormSurface/Surface/MotionView). That strips the Animated node identity and the
// raw node object reaches RCTView → native crash "ReadableNativeMap cannot be cast to Double". Put
// shadow + fill on the same raw node so the drop shadow fades WITH the card; clip corners on an
// inner plain View.
// ───────────────────────────────────────────────────────────────────────────────────────────────
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";

type Props = {
  visible: boolean;
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Forwarded to the animated wrapper — e.g. "box-none" so an anchored panel doesn't swallow taps
   * meant for the backdrop behind it. */
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  /** Called once the ENTER animation has fully finished (a genuine finish only) — the surface is on
   * screen and settled. Used by AppModal to auto-focus its first field only after the open. */
  onEnterComplete?: () => void;
  /** Called once the exit animation finishes and the content has unmounted. */
  onExitComplete?: () => void;
};

export function PopoverTransition({
  visible,
  children,
  className,
  style,
  pointerEvents,
  onEnterComplete,
  onExitComplete,
}: Props) {
  const theme = useTheme();
  // Native driver on native, JS driver on web (see useOverlayPresence for the full rationale). The
  // native driver runs opacity/scale on the UI thread, so the ENTRANCE stays smooth even while the
  // overlay's content is mounting on the JS thread — a JS-driven entrance skips frames there and
  // "clicks in". Web must stay on the JS driver (react-native-web snaps native-driven animations).
  const useNativeDriver = Platform.OS !== "web";

  // Start at final values when initially visible to avoid a flash on first mount.
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(visible ? 1 : 0.94)).current;
  // Keeps children in the tree while the exit animation plays.
  const [rendered, setRendered] = useState(visible);
  // Stable ref so the animation callback always calls the latest onExitComplete
  // without needing it in the useEffect deps array.
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;
  const onEnterCompleteRef = useRef(onEnterComplete);
  onEnterCompleteRef.current = onEnterComplete;
  // True once the popover has actually entered. Guards against a SPURIOUS exit: on first mount in
  // the hidden state (e.g. behind a `ready` gate) the lifecycle effect runs with visible=false, and
  // without this it would play an exit and fire onExitComplete for something that never opened —
  // which unmounts the overlay for a frame ("flashes off").
  const hasEnteredRef = useRef(false);

  // MOUNT / EXIT lifecycle. Mount immediately when visible; on hide, play the exit fade then
  // unmount. The ENTER fade is deliberately NOT started here — see the separate effect below.
  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }

    // Never opened yet → nothing to animate out, and firing onExitComplete here would wrongly tear
    // the overlay down. Bail.
    if (!hasEnteredRef.current) {
      return;
    }

    // Exiting — fade + shrink out, then unmount.
    if (!theme.motion.enabled) {
      opacity.setValue(0);
      scale.setValue(0.94);
      setRendered(false);
      onExitCompleteRef.current?.();
      return;
    }

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        duration: theme.motion.duration.normal,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver,
      }),
      Animated.timing(scale, {
        duration: theme.motion.duration.normal,
        easing: Easing.in(Easing.quad),
        toValue: 0.94,
        useNativeDriver,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) {
        setRendered(false);
        onExitCompleteRef.current?.();
      }
    });
    return () => anim.stop();
  }, [
    visible,
    opacity,
    scale,
    theme.motion.duration.normal,
    theme.motion.enabled,
    useNativeDriver,
  ]);

  // ENTER fade — runs only AFTER the view is actually committed to the screen (`rendered`), never in
  // the same pass that first mounts it. On the native driver the animation runs on the UI thread the
  // instant it starts; if that happens before the Animated.View exists, the node animates with
  // nothing attached and the fade is already over by the time the view mounts — the popover "pops
  // in" (or flashes). Mounting at opacity 0 first, THEN animating the committed view, makes the
  // entrance fade as smoothly as the exit. Matched to the exit duration so in and out feel symmetric.
  useEffect(() => {
    if (!rendered || !visible) {
      return;
    }
    hasEnteredRef.current = true;
    if (!theme.motion.enabled) {
      opacity.setValue(1);
      scale.setValue(1);
      onEnterCompleteRef.current?.();
      return;
    }
    // No setValue(0) here: when entering from the hidden state the view is ALREADY mounted at 0
    // (its initial value), so we animate straight from there. Forcing 0 would make a consumer that
    // mounts already-open snap to 0 and then fade — a flash.
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        duration: theme.motion.duration.normal,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver,
      }),
      // Timing (not spring) so the panel scales in without an overshoot/bounce.
      Animated.timing(scale, {
        duration: theme.motion.duration.normal,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver,
      }),
    ]);
    // Fire onEnterComplete only on a genuine finish — a stopped (interrupted) enter reports
    // finished:false, so a rapid open→close never signals "entered".
    anim.start(({ finished }) => {
      if (finished) onEnterCompleteRef.current?.();
    });
    return () => anim.stop();
  }, [
    rendered,
    visible,
    opacity,
    scale,
    theme.motion.duration.normal,
    theme.motion.enabled,
    useNativeDriver,
  ]);

  if (!rendered) return null;

  return (
    <Animated.View
      className={className}
      pointerEvents={pointerEvents}
      style={[{ opacity, transform: [{ scale }] }, style]}
    >
      {children}
    </Animated.View>
  );
}
