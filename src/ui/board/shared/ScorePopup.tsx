import { useTheme } from "@spatch-kit/theme/provider";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { PALETTE } from "@/ui/theme/palette";

import type { ScorePopupEntry } from "./useScorePopups";

/** translateY 100%->0 over 500ms concurrent with opacity 1->0 over 1500ms, positioned
 * directly above the cell rect it was shown for — mirrors TextPopup's default
 * (non-bounce) animation. */
const RISE_MS = 500;
const FADE_MS = 1500;

function ScorePopupItem({ popup }: { popup: ScorePopupEntry }) {
  const theme = useTheme();
  const motionEnabled = theme.motion.enabled;
  const rise = useRef(new Animated.Value(motionEnabled ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!motionEnabled) return;
    Animated.timing(rise, {
      toValue: 0,
      duration: RISE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // rise/opacity are stable refs — deliberately only re-running if the motion
    // preference itself changes, not on every popup id (each item mounts once).
  }, [motionEnabled, opacity, rise]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, popup.rect.height] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: popup.rect.x,
        top: popup.rect.y - popup.rect.height,
        width: popup.rect.width,
        height: popup.rect.height,
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Animated.Text
        numberOfLines={1}
        style={{
          color: popup.color,
          fontSize: popup.rect.height * 0.5,
          fontWeight: "800",
          textShadowColor: PALETTE.textShadow,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        {popup.text}
      </Animated.Text>
    </Animated.View>
  );
}

export function ScorePopupLayer({ popups }: { popups: readonly ScorePopupEntry[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {popups.map((popup) => (
        <ScorePopupItem key={popup.id} popup={popup} />
      ))}
    </View>
  );
}
