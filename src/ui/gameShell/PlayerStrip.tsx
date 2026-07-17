import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import type { Bed } from "@/core/board";
import { PALETTE } from "@/ui/theme/palette";

import { CheckoutHint } from "./CheckoutHint";

const SLIDE_MS = 220;

export interface PlayerStripEntry {
  readonly seat: number;
  readonly name: string;
  readonly score: number;
  readonly isBot: boolean;
  readonly isThrowing: boolean;
  /** 3-dart average so far this leg. */
  readonly average: number;
  /** Only meaningful while isThrowing — bestCheckout() for the score they're sitting on. */
  readonly checkout?: readonly Bed[] | null;
}

export interface PlayerStripProps {
  readonly players: readonly PlayerStripEntry[];
}

/** Every player's score as a flat column — no card, no shadow, no radius — with the throwing
 * player's whole column tinted, mirroring the original's per-column isEnabled fill rather than an
 * elevated card. The tint is a single overlay that SLIDES to the next player on a turn change, in
 * step with the board's own column highlight. Props only — no store. */
export function PlayerStrip({ players }: PlayerStripProps) {
  const motionEnabled = useTheme().motion.enabled;
  const [stripWidth, setStripWidth] = useState(0);
  const cellWidth = players.length > 0 ? stripWidth / players.length : 0;
  const activeSeat = players.findIndex((p) => p.isThrowing);
  const translateX = useRef(new Animated.Value(0)).current;
  const positioned = useRef(false);

  useEffect(() => {
    if (activeSeat < 0 || cellWidth === 0) return;
    const to = activeSeat * cellWidth;
    // First placement (and reduced motion) snaps; later turn changes slide.
    if (!motionEnabled || !positioned.current) {
      translateX.setValue(to);
      positioned.current = true;
      return;
    }
    Animated.timing(translateX, {
      toValue: to,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeSeat, cellWidth, motionEnabled, translateX]);

  return (
    <View
      onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}
      style={{ backgroundColor: PALETTE.header, flexDirection: "row", position: "relative" }}
    >
      {activeSeat >= 0 && cellWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            backgroundColor: PALETTE.activeHighlight,
            borderColor: PALETTE.divider,
            borderWidth: 1,
            bottom: 0,
            left: 0,
            position: "absolute",
            top: 0,
            transform: [{ translateX }],
            width: cellWidth,
          }}
        />
      ) : null}
      {players.map((p) => (
        <View
          key={p.seat}
          style={{
            alignItems: "center",
            flex: 1,
            gap: 2,
            paddingVertical: PALETTE.controlPadding,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            {p.isBot ? <AppIcon color={PALETTE.text} name="bot" size={12} /> : null}
            <Text
              numberOfLines={1}
              style={{ color: PALETTE.text, fontSize: 13, fontWeight: "700" }}
            >
              {p.name}
            </Text>
          </View>
          <Text style={{ color: PALETTE.text, fontSize: 30, fontWeight: "800" }}>{p.score}</Text>
          {p.isThrowing ? <CheckoutHint beds={p.checkout ?? null} /> : null}
          <Text style={{ color: PALETTE.text, fontSize: 11, opacity: 0.75 }}>
            {p.average.toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}
