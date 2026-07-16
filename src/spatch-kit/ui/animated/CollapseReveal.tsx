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

// Collapse/expand + fade for content that reveals in place (e.g. the address field's map when the
// user hits "Show map"). Mirrors the inline-edit card swap (InlineEditMotion): the container height
// animates open/closed so the content below slides down/up, while the body crossfades — so the
// reveal reads exactly like a detail section expanding under the edit pencil.
//
// The content is measured from an ABSOLUTELY-positioned layer. That's the crucial bit: an in-flow
// child inside a height-0, overflow-hidden container can be constrained/measured as 0 (a MapView in
// particular reports 0 there) — which would leave the reveal stuck closed with nothing visible. An
// absolute layer is laid out at its natural size regardless of the clip, so onLayout always reports
// the real height and the container can animate 0 → that height.
//
// Platform-split like InlineEditMotion: native animates the real height on the UI thread
// (Reanimated); web uses a CSS height transition (choppy per-frame JS height writes otherwise).
//
// Lazy-mount: children aren't rendered until the FIRST reveal, then kept mounted — so a heavy child
// (a MapView) mounts once, on demand, never while a creator popup is still animating in.

type CollapseRevealProps = { open: boolean; children: ReactNode };

export function CollapseReveal({ open, children }: CollapseRevealProps) {
  const theme = useTheme();
  const [hasOpened, setHasOpened] = useState(open);

  useEffect(() => {
    if (open) {
      setHasOpened(true);
    }
  }, [open]);

  if (!hasOpened) {
    return null;
  }

  if (!theme.motion.enabled) {
    return open ? <View>{children}</View> : null;
  }

  return Platform.OS === "web" ? (
    <CollapseRevealWeb open={open}>{children}</CollapseRevealWeb>
  ) : (
    <CollapseRevealNative open={open}>{children}</CollapseRevealNative>
  );
}

// ── Web: CSS transitions ─────────────────────────────────────────────────────────────────────

function CollapseRevealWeb({ open, children }: CollapseRevealProps) {
  const theme = useTheme();
  const duration = theme.motion.duration.normal;
  const [naturalHeight, setNaturalHeight] = useState(0);
  // Transitions stay OFF until the first frame so the initial reveal animates from collapsed
  // instead of the browser snapping straight to the open size on mount.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next <= 0) {
      return;
    }
    setNaturalHeight((previous) => (previous === next ? previous : next));
  }, []);

  const shown = ready && open;
  const containerStyle = {
    height: shown ? naturalHeight : 0,
    position: "relative",
    overflow: "hidden",
    transitionProperty: ready ? "height" : "none",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "ease-out",
  } as unknown as ViewStyle;
  const contentStyle = {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    opacity: shown ? 1 : 0,
    transitionProperty: ready ? "opacity" : "none",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "ease-out",
  } as unknown as ViewStyle;

  return (
    <View style={containerStyle}>
      <View onLayout={onLayout} style={contentStyle}>
        {children}
      </View>
    </View>
  );
}

// ── Native: Reanimated ───────────────────────────────────────────────────────────────────────

function CollapseRevealNative({ open, children }: CollapseRevealProps) {
  const theme = useTheme();
  const duration = theme.motion.duration.normal;
  const naturalHeight = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      if (next <= 0 || next === naturalHeight.current) {
        return;
      }
      naturalHeight.current = next;
      // Track the content's natural size while open (the map's height settles a frame after mount)
      // so the reveal lands on — and stays at — the real height.
      if (openRef.current) {
        height.value = withTiming(next, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    [duration, height],
  );

  useEffect(() => {
    height.value = withTiming(open ? naturalHeight.current : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(open ? 1 : 0, { duration });
  }, [open, duration, height, opacity]);

  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[containerStyle, { overflow: "hidden" }]}>
      <Animated.View
        onLayout={onLayout}
        style={[contentStyle, { position: "absolute", left: 0, right: 0, top: 0 }]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
