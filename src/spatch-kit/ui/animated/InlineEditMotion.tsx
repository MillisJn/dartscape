import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Platform,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@spatch-kit/theme/provider";

// Crossfade + resize for cards that edit in place (the pencil flips read mode into an editor).
//
// Two goals, and the reason this is platform-split:
//
//  1. RESIZE — the card grows/shrinks between the read body and the (taller) editor body.
//     • NATIVE: Reanimated animates the real height on the UI thread (smooth).
//     • WEB:    Reanimated's per-frame JS height writes are choppy, and its layout animations
//               scale the box (stretching the content — see #6889). Instead we use a real CSS
//               transition on `height`, which react-native-web maps straight to the DOM and the
//               browser animates off the main thread (smooth, no stretch).
//
//  2. CROSSFADE — the outgoing body must fade OUT while the incoming body fades IN. The incoming
//     body sits in normal flow so it drives the measured height; the outgoing body is frozen as
//     an absolutely-positioned overlay so it can fade without affecting layout (and without
//     doubling the height, which a naive in-flow crossfade would do).

type SwapLayer = { key: string; node: ReactNode };

// Tracks the previous body so it can be kept around (as the fading-out overlay) for one
// animation cycle after `swapKey` changes. Snapshots during render so there's no blank frame.
function useOutgoingLayer(
  swapKey: string,
  children: ReactNode,
  duration: number,
): SwapLayer | null {
  const [outgoing, setOutgoing] = useState<SwapLayer | null>(null);
  // Tracked-in-state so the swap is detected via the sanctioned "adjust state during render"
  // pattern; lastChildren is updated in an effect (never mutated during render) so this stays
  // StrictMode-safe.
  const [renderedKey, setRenderedKey] = useState(swapKey);
  const lastChildren = useRef<ReactNode>(children);

  if (renderedKey !== swapKey) {
    setOutgoing({ key: renderedKey, node: lastChildren.current });
    setRenderedKey(swapKey);
  }

  useEffect(() => {
    lastChildren.current = children;
  });

  useEffect(() => {
    if (!outgoing) {
      return;
    }
    // Drop the overlay once it has finished fading (small buffer past the duration).
    const id = setTimeout(() => setOutgoing(null), duration + 60);
    return () => clearTimeout(id);
  }, [outgoing, duration]);

  return outgoing;
}

type SwapProps = { swapKey: string; children: ReactNode };

// Read-mode/edit-mode swap with an animated card height. Drop it inside a SectionSurface that
// renders with `bodyPadded={false}` — the layers below own the body padding/gap so the animated
// box is a single padded surface. Falls back to a static padded view under reduced motion.
export function InlineEditCardSwap({ swapKey, children }: SwapProps) {
  const theme = useTheme();

  if (!theme.motion.enabled) {
    return (
      <View style={{ gap: theme.space.md, padding: theme.space.sm }}>
        {children}
      </View>
    );
  }

  return Platform.OS === "web" ? (
    <InlineEditCardSwapWeb swapKey={swapKey}>{children}</InlineEditCardSwapWeb>
  ) : (
    <InlineEditCardSwapNative swapKey={swapKey}>
      {children}
    </InlineEditCardSwapNative>
  );
}

// ── Web: CSS transitions ────────────────────────────────────────────────────────────────────

function InlineEditCardSwapWeb({ swapKey, children }: SwapProps) {
  const theme = useTheme();
  const duration = theme.motion.duration.normal;
  const outgoing = useOutgoingLayer(swapKey, children, duration);

  const [height, setHeight] = useState<number | undefined>(undefined);
  // Transitions stay OFF until the first height is painted, so the card appears at full size on
  // mount instead of animating up from zero. Flipped on a frame after the first measurement.
  const [animate, setAnimate] = useState(false);
  const target = useRef<number | null>(null);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next === target.current) {
      return;
    }
    const first = target.current === null;
    target.current = next;
    setHeight(next);
    if (first) {
      requestAnimationFrame(() => setAnimate(true));
    }
  }, []);

  const containerStyle = {
    height,
    overflow: "hidden",
    transitionProperty: animate ? "height" : "none",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "ease-out",
  } as unknown as ViewStyle;

  return (
    <View style={containerStyle}>
      <WebFadeLayer
        key={swapKey}
        duration={duration}
        fade={animate ? "in" : "none"}
        onLayout={onContentLayout}
      >
        {children}
      </WebFadeLayer>
      {outgoing ? (
        <WebFadeLayer
          key={`out-${outgoing.key}`}
          absolute
          duration={duration}
          fade="out"
        >
          {outgoing.node}
        </WebFadeLayer>
      ) : null}
    </View>
  );
}

function WebFadeLayer({
  children,
  duration,
  fade,
  absolute,
  onLayout,
}: {
  children: ReactNode;
  duration: number;
  fade: "in" | "out" | "none";
  absolute?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  // Start at the pre-transition value, then flip on the next frame so the browser registers the
  // change and animates the opacity (CSS can't transition a value set on the very first paint).
  const [opacity, setOpacity] = useState(fade === "in" ? 0 : 1);

  useEffect(() => {
    if (fade === "none") {
      return;
    }
    const id = requestAnimationFrame(() => setOpacity(fade === "in" ? 1 : 0));
    return () => cancelAnimationFrame(id);
    // Mount-only: the layer is keyed by its mode, so a real swap remounts it.
  }, []);

  const style = {
    gap: theme.space.md,
    padding: theme.space.sm,
    opacity,
    transitionProperty: "opacity",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "ease-out",
    ...(absolute ? { position: "absolute", left: 0, right: 0, top: 0 } : null),
  } as unknown as ViewStyle;

  return (
    <View
      onLayout={onLayout}
      // The fading-out overlay must not eat taps meant for the incoming body underneath.
      pointerEvents={absolute ? "none" : undefined}
      style={style}
    >
      {children}
    </View>
  );
}

// ── Native: Reanimated ──────────────────────────────────────────────────────────────────────

function InlineEditCardSwapNative({ swapKey, children }: SwapProps) {
  const theme = useTheme();
  const duration = theme.motion.duration.normal;

  const height = useSharedValue<number | undefined>(undefined);
  const target = useRef<number | null>(null);
  const measured = useRef(false);

  // Crossfade managed inline (NOT useOutgoingLayer's fixed timer). The incoming body can measure
  // hundreds of ms LATE — a heavy/async card mounting while the JS thread is busy (a background
  // fetch landing, say) doesn't lay out until well after a timer would
  // have retired the outgoing layer, leaving a blank gap and a fade that already ran on an empty
  // frame. So we HOLD the outgoing (previous body) fully opaque on top until the incoming actually
  // paints (its first onLayout), THEN fade the outgoing away to reveal it while the height animates
  // — fade and resize always run together, on real content, however late it arrives. A light body
  // paints next-frame, so this is indistinguishable from an immediate crossfade.
  const [renderedKey, setRenderedKey] = useState(swapKey);
  const [outgoing, setOutgoing] = useState<SwapLayer | null>(null);
  // Flips true once the CURRENT incoming body has laid out; drives the outgoing's reveal fade.
  const [incomingPainted, setIncomingPainted] = useState(false);
  const lastChildren = useRef<ReactNode>(children);

  if (renderedKey !== swapKey) {
    setOutgoing({ key: renderedKey, node: lastChildren.current });
    setRenderedKey(swapKey);
    setIncomingPainted(false);
  }

  useEffect(() => {
    lastChildren.current = children;
  });

  // Retire the outgoing overlay once its reveal fade (which starts when the incoming paints) is done.
  useEffect(() => {
    if (!outgoing || !incomingPainted) {
      return;
    }
    const id = setTimeout(() => setOutgoing(null), duration + 60);
    return () => clearTimeout(id);
  }, [outgoing, incomingPainted, duration]);

  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      if (next !== target.current) {
        const first = target.current === null;
        target.current = next;
        if (first) {
          // Snap to full size on mount; animate every change after that.
          height.value = next;
          measured.current = true;
        } else {
          height.value = withTiming(next, {
            duration,
            easing: Easing.out(Easing.cubic),
          });
        }
      }
      // The incoming body has painted → release the held outgoing layer to fade out and reveal it,
      // in step with the height animation above. Idempotent after the first fire.
      setIncomingPainted(true);
    },
    [duration, height],
  );

  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View style={[containerStyle, { overflow: "hidden" }]}>
      {/* Incoming (in-flow, drives the measured height). During a swap it starts hidden and fades IN
          only once it has painted (reveal=incomingPainted) — never on an empty pre-paint frame. On
          the very first mount there's no outgoing, so it's static (mode "none") and appears at once. */}
      <NativeFadeLayer
        key={swapKey}
        duration={duration}
        mode={outgoing ? "in" : "none"}
        onLayout={onContentLayout}
        reveal={incomingPainted}
      >
        {children}
      </NativeFadeLayer>
      {outgoing ? (
        // Outgoing overlay: held fully opaque on top until the incoming paints, then fades OUT in
        // step with the incoming's fade-in and the height animation — a real two-way crossfade.
        <NativeFadeLayer
          key={`out-${outgoing.key}`}
          absolute
          duration={duration}
          mode="out"
          reveal={incomingPainted}
        >
          {outgoing.node}
        </NativeFadeLayer>
      ) : null}
    </Animated.View>
  );
}

function NativeFadeLayer({
  children,
  duration = 0,
  mode = "none",
  reveal = false,
  absolute,
  onLayout,
}: {
  children: ReactNode;
  duration?: number;
  // "in": incoming layer — starts transparent, fades to opaque when `reveal` flips true (the body
  // has painted). "out": outgoing overlay — starts opaque, fades away when `reveal` flips true.
  // "none": static, always opaque (the first-ever mount, before any swap).
  mode?: "in" | "out" | "none";
  reveal?: boolean;
  absolute?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(mode === "in" ? 0 : 1);

  useEffect(() => {
    if (mode === "in") {
      opacity.value = reveal ? withTiming(1, { duration }) : 0;
    } else if (mode === "out") {
      opacity.value = reveal ? withTiming(0, { duration }) : 1;
    } else {
      opacity.value = 1;
    }
  }, [mode, reveal, duration, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      onLayout={onLayout}
      // The fading-out overlay must not eat taps meant for the incoming body underneath.
      pointerEvents={absolute ? "none" : undefined}
      style={[
        style,
        { gap: theme.space.md, padding: theme.space.sm },
        absolute ? { position: "absolute", left: 0, right: 0, top: 0 } : null,
      ]}
    >
      {children}
    </Animated.View>
  );
}
