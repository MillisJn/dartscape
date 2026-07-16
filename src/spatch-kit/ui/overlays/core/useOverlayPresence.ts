import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { deferPastCommit } from "@spatch-kit/ui/utils/deferPastCommit";

export type OverlayPresence = {
  // True while the overlay should stay rendered — including the brief exit animation AFTER
  // `visible` flips to false. Surfaces gate their render on this (not on `visible`) so the
  // close transition can play before the tree unmounts.
  mounted: boolean;
  // 0 → 1 driver for the shaded backdrop. Leads the content in, trails it out.
  backdropOpacity: Animated.Value;
  // 0 → 1 driver for the panel/modal/menu body. Trails the backdrop in, leads it out.
  contentOpacity: Animated.Value;
  // 0 → 1 slide driver (0 = fully off the bottom edge, 1 = resting). Only animated when the
  // `slide` option is set; a sheet consumer interpolates it to a pixel translateY. Runs on the
  // native driver alongside the fades and is folded into the exit parallel, so unmount waits for
  // the slide-down to finish. Stays at 1 (resting) for non-slide consumers.
  contentSlide: Animated.Value;
  // 0.94 → 1 scale driver for CENTERED (non-slide) surfaces — the "grow + fade in / shrink + fade
  // out" motion of the profile menu / delete alert (PopoverTransition), unified onto every centered
  // dialog and menu. Only animated when `slide` is false; slide sheets rest it at 1 (they slide,
  // they don't grow). Runs on the native driver alongside the content fade.
  contentScale: Animated.Value;
};

export type OverlayPresenceOptions = {
  // Fired once the ENTER animation has fully completed (or immediately when motion is disabled) —
  // i.e. the surface is on screen, painted, and its slide/fade has settled. NOT fired if the open is
  // interrupted (the enter animation was stopped before finishing). A consumer uses this to run
  // something that must wait for a STABLE view tree, e.g. auto-focusing the first form field on
  // native without racing the mid-mount Fabric focus-search crash.
  onEnterComplete?: () => void;
  // Fired once the EXIT animation has fully completed (or immediately when motion is disabled).
  // Request-driven popups that are conditionally mounted by a parent use this to clear their
  // "rendered" payload AFTER the fade-out, so the close transition can play before unmount.
  onExitComplete?: () => void;
  // Opt-in bottom-sheet motion: also drive `contentSlide` (0→1 in, 1→0 out) so the surface slides
  // up from the bottom on open and back down on close, in step with the fades. Default false.
  slide?: boolean;
};

// Coordinated enter/exit transition shared by every overlay surface (modals, popups, menus) on
// EVERY platform. The motion the product wants:
//   • in  — the shaded backdrop fades in, then the body fades in very shortly after.
//   • out — the body fades out, then the backdrop fades out very shortly after.
// We model that with two opacity drivers on slightly offset timelines. Because web's overlays
// teleport to <body> (OverlayPortal.web) and the surfaces previously unmounted the instant
// `visible` went false, NOTHING animated out anywhere. Keeping the subtree mounted until the
// exit animation finishes (the `mounted` flag) is what makes the close transition possible —
// and what finally makes web animate at all.
export function useOverlayPresence(
  visible: boolean,
  options?: OverlayPresenceOptions,
): OverlayPresence {
  const theme = useTheme();
  const { motion } = theme;
  const enabled = motion.enabled;
  // Native driver on native, JS driver on web — genuinely different methods per platform:
  //  • native: opacity/scale run on the UI thread, so the fade stays smooth EVEN WHILE the overlay's
  //    content is still mounting/laying out on the JS thread (a JS-driven fade stutters there — the
  //    entrance runs concurrently with the mount, the exit doesn't, which is why exits looked fine
  //    but entrances didn't).
  //  • web: the react-native-web Animated runtime SNAPS native-driven animations instead of
  //    tweening them (see DataTable), so web must stay on the JS driver.
  // The old entrance "pop" was never the driver; it was overlays animating before they were on
  // screen. The `ready` gate in the consumer (AppAlertHost / AccountMenu / FloatingActionMenu) fixes
  // that by holding the transition hidden until the portal has actually presented.
  const useNativeDriver = Platform.OS !== "web";

  // Latest enter/exit callbacks without retriggering the animation effect when the callback identity
  // changes between renders.
  const onEnterCompleteRef = useRef(options?.onEnterComplete);
  onEnterCompleteRef.current = options?.onEnterComplete;
  const onExitCompleteRef = useRef(options?.onExitComplete);
  onExitCompleteRef.current = options?.onExitComplete;

  // Start HIDDEN whenever motion is on — even if the overlay mounts already-open. The detail /
  // creator / editor popups are conditionally mounted with visible=true, so initializing to the
  // resting (shown) state would skip their entrance entirely; starting at 0 and animating in is
  // what makes them fade in on web (and everywhere). With motion off, snap to the resting state
  // so there's no flash.
  const initialOpacity = enabled ? 0 : visible ? 1 : 0;
  const backdropOpacity = useRef(new Animated.Value(initialOpacity)).current;
  const contentOpacity = useRef(new Animated.Value(initialOpacity)).current;
  // Sheet slide driver. Hidden (0 = off the bottom edge) when it should animate in; otherwise it
  // rests at 1 so non-slide consumers (and the motion-off path) read a neutral, on-screen value.
  const slide = options?.slide ?? false;
  const contentSlide = useRef(
    new Animated.Value(enabled && slide ? 0 : 1),
  ).current;
  // Centered surfaces start slightly shrunk (0.94) and grow to 1 on enter; slide sheets rest at 1
  // (they don't grow). Motion-off snaps to 1.
  const contentScale = useRef(
    new Animated.Value(enabled && !slide ? 0.94 : 1),
  ).current;
  const [mounted, setMounted] = useState(visible);
  // Enter gate — invariant #2 (see PopoverTransition's header block). Flips true ONE commit AFTER
  // the overlay has mounted, so the ENTER fade (both backdrop and content) starts on views that are
  // already committed and painted at opacity 0 — never in the same pass that mounts them. On the
  // native driver an enter animation that starts before its view exists finishes before the view
  // appears, so you'd see a "pop"/flicker instead of a fade. This is what fixes the modal backdrop
  // flicker too, since the backdrop rides the same drivers.
  const [entered, setEntered] = useState(false);

  // Becoming visible re-mounts immediately; becoming hidden defers unmount to the exit animation.
  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  // Arm the enter TWO frames past the mount commit (deferPastCommit) — for BOTH centered and slide.
  // This guarantees the overlay's whole tree is committed AND painted before the native animation
  // starts, so the animation never competes with the initial mount/layout on the UI thread (that
  // competition is what dropped frames — the animation ran while the card's views were still being
  // created). Arming in the same commit (or one frame in) starts the fade/slide/grow mid-mount and
  // janks the first frames on any non-trivial overlay. Only DISARM on full unmount (not on hide) so a
  // re-run mid-exit can't restart the exit.
  useEffect(() => {
    if (mounted && visible) {
      return deferPastCommit(() => setEntered(true));
    }
    if (!mounted) {
      setEntered(false);
    }
  }, [mounted, visible]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    // Motion disabled (reduce-motion preference): snap to the target, no animation.
    if (!enabled) {
      if (visible) {
        backdropOpacity.setValue(1);
        contentOpacity.setValue(1);
        contentSlide.setValue(1);
        contentScale.setValue(1);
        onEnterCompleteRef.current?.();
      } else {
        setMounted(false);
        onExitCompleteRef.current?.();
      }
      return;
    }

    if (visible) {
      // Wait until the view is committed & painted at 0 (see `entered`) before fading in.
      if (!entered) {
        return;
      }
      // ENTER: backdrop first, body a beat later. A slide sheet slides up in step with the backdrop
      // over the normal duration with an ease-out; a centered surface grows from 0.94→1 in parallel
      // with its fade — the profile-menu / alert motion — so the two kinds share one prompt feel.
      const animation = Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: motion.duration.fast,
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          delay: motion.delay.md,
          duration: motion.duration.normal,
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
        ...(slide
          ? [
              Animated.timing(contentSlide, {
                toValue: 1,
                duration: motion.duration.normal,
                easing: Easing.out(Easing.cubic),
                useNativeDriver,
              }),
            ]
          : [
              Animated.timing(contentScale, {
                toValue: 1,
                duration: motion.duration.normal,
                easing: Easing.out(Easing.cubic),
                useNativeDriver,
              }),
            ]),
      ]);
      // Fire onEnterComplete only on a genuine finish — a stopped (interrupted) enter reports
      // finished:false, so a rapid open→close never signals "entered" (and never auto-focuses into a
      // tearing-down tree).
      animation.start(({ finished }) => {
        if (finished) {
          onEnterCompleteRef.current?.();
        }
      });
      return () => animation.stop();
    }

    // EXIT: body first, backdrop a beat later — then unmount. A slide sheet slides back down; a
    // centered surface shrinks back to 0.94 while it fades. Folding the transform into the parallel
    // makes unmount wait for the motion to finish.
    let cancelled = false;
    const animation = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: motion.duration.fast,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        delay: motion.delay.sm,
        duration: motion.duration.normal,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }),
      ...(slide
        ? [
            Animated.timing(contentSlide, {
              toValue: 0,
              duration: motion.duration.normal,
              easing: Easing.in(Easing.cubic),
              useNativeDriver,
            }),
          ]
        : [
            Animated.timing(contentScale, {
              toValue: 0.94,
              duration: motion.duration.normal,
              easing: Easing.in(Easing.cubic),
              useNativeDriver,
            }),
          ]),
    ]);
    animation.start(({ finished }) => {
      if (finished && !cancelled) {
        setMounted(false);
        onExitCompleteRef.current?.();
      }
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [
    visible,
    mounted,
    entered,
    enabled,
    slide,
    useNativeDriver,
    motion.duration.fast,
    motion.duration.normal,
    motion.delay.md,
    motion.delay.sm,
    backdropOpacity,
    contentOpacity,
    contentSlide,
    contentScale,
  ]);

  return { mounted, backdropOpacity, contentOpacity, contentSlide, contentScale };
}
