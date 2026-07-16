import { useCallback, useEffect, useRef } from "react";
import { useIsFocused } from "expo-router/react-navigation";
import type { ViewProps } from "react-native";

import {
  buildRouteKey,
  goBackOnce,
  navigateHrefOnce,
  pushHrefOnce,
  replaceHrefOnce,
  stripDynamicSegmentParams,
  syncNavigationRoute,
} from "./navigationRuntime";

export {
  buildRouteKey,
  goBackOnce,
  navigateHrefOnce,
  pushHrefOnce,
  replaceHrefOnce,
  stripDynamicSegmentParams,
  syncNavigationRoute,
};

export function useSinglePress(onPress: (() => void) | undefined) {
  const onPressRef = useRef(onPress);

  onPressRef.current = onPress;

  return useCallback(() => {
    if (!onPressRef.current) {
      return;
    }

    onPressRef.current();
  }, []);
}

export function useNavigationIntentGate() {
  const isFocused = useIsFocused();
  const epochRef = useRef(0);
  const wasFocusedRef = useRef(false);
  const lastHandledEpochRef = useRef<number | null>(null);

  useEffect(() => {
    if (isFocused && !wasFocusedRef.current) {
      epochRef.current += 1;
    }

    wasFocusedRef.current = isFocused;
  }, [isFocused]);

  return useCallback(
    (action: () => void) => {
      if (!isFocused) {
        return false;
      }

      if (lastHandledEpochRef.current === epochRef.current) {
        return false;
      }

      lastHandledEpochRef.current = epochRef.current;
      action();
      return true;
    },
    [isFocused],
  );
}

export function useNavigationSurfaceProps(): Pick<ViewProps, "pointerEvents"> {
  const isFocused = useIsFocused();

  return {
    pointerEvents: isFocused ? "auto" : "none",
  };
}
