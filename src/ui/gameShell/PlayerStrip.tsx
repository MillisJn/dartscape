import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { Text, View } from "react-native";
import type { Bed } from "@/core/board";
import { PALETTE } from "@/ui/theme/palette";

import { CheckoutHint } from "./CheckoutHint";

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

/** Every player's score as a flat column — no card, no shadow, no radius — with the
 * throwing player's whole column tinted, mirroring the original's per-column
 * isEnabled fill rather than an elevated card. Props only — no store. */
export function PlayerStrip({ players }: PlayerStripProps) {
  return (
    <View style={{ backgroundColor: PALETTE.header, flexDirection: "row" }}>
      {players.map((p) => (
        <View
          key={p.seat}
          style={{
            alignItems: "center",
            backgroundColor: p.isThrowing ? PALETTE.activeHighlight : "transparent",
            borderColor: p.isThrowing ? PALETTE.divider : "transparent",
            borderWidth: 1,
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
