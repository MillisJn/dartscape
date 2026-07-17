import {
  BlurMask,
  Canvas,
  Group,
  matchFont,
  Paint,
  Text as SkiaText,
} from "@shopify/react-native-skia";
import { useTheme } from "@spatch-kit/theme/provider";
import { useEffect, useMemo, useRef } from "react";
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

  const { rect } = popup;
  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [0, rect.height],
  });

  // Drawn with Skia so the text can carry a real STROKE outline (a dark stroke pass under the
  // colored fill, plus a soft blurred shadow) — the OG's outlineText look, which plain RN Text
  // can't do. The RN Animated.View around it still owns the rise/fade (native driver); the Skia
  // canvas just paints the static glyph.
  const fontSize = rect.height * 0.5;
  // Heaviest weight the fallback face has — the popup number should read as thick/bold.
  const font = useMemo(
    () =>
      matchFont({
        fontFamily: theme.fonts.sansBold,
        fontSize,
        fontWeight: "900",
      }),
    [theme.fonts.sansBold, fontSize],
  );
  const textWidth = font.measureText(popup.text).width;

  const outlineStroke = Math.max(2, fontSize * 0.09);
  const shadowBlur = Math.max(2, fontSize * 0.14);
  const padX = fontSize;
  const padY = fontSize * 0.5;
  const canvasWidth = rect.width + padX;
  const canvasHeight = rect.height + padY;
  const tx = (canvasWidth - textWidth) / 2;
  const ty = canvasHeight / 2 + fontSize / 3;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        height: canvasHeight,
        left: rect.x - padX / 2,
        opacity,
        position: "absolute",
        top: rect.y - rect.height - padY / 2,
        transform: [{ translateY }],
        width: canvasWidth,
      }}
    >
      <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
        {/* 1. Blurred dark shadow behind — ONLY this layer is blurred (BlurMask is scoped to this
            Group), so the glyph itself stays crisp. */}
        <Group>
          <BlurMask blur={shadowBlur} style="normal" />
          <SkiaText color={PALETTE.textShadow} font={font} text={popup.text} x={tx} y={ty} />
        </Group>
        {/* 2. Crisp black outline (a stroke pass, no blur). */}
        <SkiaText font={font} text={popup.text} x={tx} y={ty}>
          <Paint
            color={PALETTE.textShadow}
            strokeJoin="round"
            strokeWidth={outlineStroke}
            style="stroke"
          />
        </SkiaText>
        {/* 3. Colored fill on top. */}
        <SkiaText color={popup.color} font={font} text={popup.text} x={tx} y={ty} />
      </Canvas>
    </Animated.View>
  );
}

export function ScorePopupLayer({ popups }: { popups: readonly ScorePopupEntry[] }) {
  return (
    // High zIndex + Android elevation so a popup rising off the top row draws ON TOP of the score
    // strip above it, never behind — see GameScreen (cricket is unscrolled so nothing clips it).
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}>
      {popups.map((popup) => (
        <ScorePopupItem key={popup.id} popup={popup} />
      ))}
    </View>
  );
}
