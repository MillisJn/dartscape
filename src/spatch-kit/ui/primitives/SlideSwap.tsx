import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useTheme } from "@spatch-kit/theme/provider";
import { deferPastCommit } from "@spatch-kit/ui/utils/deferPastCommit";

// A horizontal PUSH between full-screen views, keyed by `transitionKey`. Unlike CrossfadeSwap's slide
// (whose leaving layer inherits a stale exit direction, so repeated/reversed swaps cross the wrong
// way), this drives both layers with an explicit shared `progress`, so direction is always correct:
//   • "forward" slides the new view in from the RIGHT while the old slides out to the LEFT.
//   • "back" slides the new in from the LEFT while the old slides out to the RIGHT.
// Two fixed slots hold the views (the outgoing one is never re-parented → no remount), content is
// state-driven so there's no one-frame flash of the new view before it slides, and every layer sets
// opacity explicitly (a partial style would leave opacity stuck at 0 and blank the view).

type Slot = 0 | 1;

type SwapState = {
  // The element rendered in each physical slot (null = empty).
  nodes: [ReactNode, ReactNode];
  // The slot showing the current view.
  display: Slot;
  // The slot sliding out (null when settled).
  exit: Slot | null;
  // Key currently displayed.
  displayKey: string;
  // Direction of the in-flight transition.
  dir: "back" | "forward";
};

function setNode(
  nodes: [ReactNode, ReactNode],
  slot: Slot,
  node: ReactNode,
): [ReactNode, ReactNode] {
  return slot === 0 ? [node, nodes[1]] : [nodes[0], node];
}

export function SlideSwap({
  transitionKey,
  direction,
  children,
  className,
  style,
}: {
  transitionKey: string;
  direction: "back" | "forward";
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const duration = theme.motion.enabled ? theme.motion.duration.slow : 0;
  const [width, setWidth] = useState(0);
  // 1 = settled (display view at x:0). A transition animates 0 → 1.
  const progress = useSharedValue(1);

  const [state, setState] = useState<SwapState>({
    nodes: [children, null],
    display: 0,
    exit: null,
    displayKey: transitionKey,
    dir: "forward",
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const genRef = useRef(0);

  function finish(gen: number) {
    if (gen !== genRef.current) {
      return;
    }
    setState((s) =>
      s.exit == null
        ? s
        : { ...s, exit: null, nodes: setNode(s.nodes, s.exit, null) },
    );
  }

  // Swap when the KEY changes. Deliberately NOT keyed on `children`, so the frequent re-renders while
  // the new view's data settles don't re-run this effect (and cancel the pending slide-start below).
  useEffect(() => {
    const s = stateRef.current;
    if (transitionKey === s.displayKey) {
      return; // same view — the refresh effect keeps its content fresh
    }
    genRef.current += 1;
    const gen = genRef.current;
    if (width === 0) {
      // No layout yet — swap in place, no animation.
      setState((prev) => ({
        ...prev,
        nodes: setNode(prev.nodes, prev.display, children),
        exit: null,
        displayKey: transitionKey,
      }));
      return;
    }
    // Stage the new view in the OTHER slot, off-screen; the old slot keeps its (now frozen) content as
    // the exit and stays fully visible underneath.
    const newDisplay: Slot = s.display === 0 ? 1 : 0;
    cancelAnimation(progress);
    progress.value = 0;
    setState((prev) => ({
      nodes: setNode(prev.nodes, newDisplay, children),
      display: newDisplay,
      exit: prev.display,
      displayKey: transitionKey,
      dir: direction,
    }));
    // Start the slide only AFTER the newly-staged view has committed AND painted (two frames), so the
    // animation plays over already-mounted content instead of dropping frames while the new view (e.g.
    // a FlatList) mounts. This is what makes it as smooth as the settings sheet (which waits on its
    // readiness gate). The cleanup cancels a pending start if a newer swap supersedes this one.
    return deferPastCommit(() => {
      if (gen !== genRef.current) {
        return;
      }
      progress.value = withTiming(1, { duration }, (finished) => {
        if (finished) {
          runOnJS(finish)(gen);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey, width]);

  // Keep the current view's live content fresh (e.g. its rows changed) without restarting a swap.
  useEffect(() => {
    const s = stateRef.current;
    if (transitionKey === s.displayKey && s.nodes[s.display] !== children) {
      setState((prev) => ({
        ...prev,
        nodes: setNode(prev.nodes, prev.display, children),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  const transitioning = state.exit != null;

  return (
    <View
      className={className}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.fill, style]}
    >
      {([0, 1] as Slot[]).map((i) => {
        const role =
          i === state.display ? "display" : i === state.exit ? "exit" : "idle";
        return (
          <SlideSwapLayer
            key={i}
            dir={state.dir}
            interactive={role === "display" && !transitioning}
            progress={progress}
            role={role}
            transitioning={transitioning}
            width={width}
          >
            {state.nodes[i]}
          </SlideSwapLayer>
        );
      })}
    </View>
  );
}

function SlideSwapLayer({
  children,
  dir,
  interactive,
  progress,
  role,
  transitioning,
  width,
}: {
  children: ReactNode;
  dir: "back" | "forward";
  interactive: boolean;
  progress: SharedValue<number>;
  role: "display" | "exit" | "idle";
  transitioning: boolean;
  width: number;
}) {
  // Complete styles in every branch (opacity + translateX): reanimated persists any omitted property,
  // so a partial style would leave opacity stuck at 0 and blank a reused slot.
  const style = useAnimatedStyle(() => {
    if (role === "display") {
      // At rest, pinned at x:0 and fully opaque (never reads progress → can't be stranded). During a
      // swap it's the incoming view: slides in from the side AND fades in.
      if (!transitioning) {
        return { opacity: 1, transform: [{ translateX: 0 }] };
      }
      const from = dir === "forward" ? width : -width;
      return {
        opacity: progress.value,
        transform: [{ translateX: from * (1 - progress.value) }],
      };
    }
    if (role === "exit") {
      // Slides out the opposite way to the incoming view AND fades out.
      const to = dir === "forward" ? -width : width;
      return {
        opacity: 1 - progress.value,
        transform: [{ translateX: to * progress.value }],
      };
    }
    return { opacity: 0, transform: [{ translateX: 0 }] };
  }, [role, dir, width, transitioning]);

  const zIndex = role === "display" ? 2 : role === "exit" ? 1 : 0;

  return (
    <Animated.View
      pointerEvents={interactive ? "auto" : "none"}
      style={[StyleSheet.absoluteFill, { zIndex }, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: "hidden" },
});
