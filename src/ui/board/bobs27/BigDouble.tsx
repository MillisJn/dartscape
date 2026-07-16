import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { type Dart, INNER_BULL, isBed, isMiss, MISS, OUTER_BULL, type Wedge } from "@/core/board";
import { valueOfRound } from "@/core/game/bobs27";
import type { GameView } from "@/core/game/view";

import { TargetBoard } from "../shared/TargetBoard";
import type { TargetCell } from "../shared/targetGrid";

export interface BigDoubleProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
}

/** Bob's 27: one big double a round, the cliff edge. Only a double (or the double bull) scores;
 * everything else is a miss for this round's purposes, but the real ring is still recorded. */
export function BigDouble({ view, width, onLand, onUpgrade }: BigDoubleProps) {
  const theme = useTheme();
  if (view.panel.kind !== "bobs27") return null;
  const { target, round, lastRound, hits } = view.panel;
  const isBull = target === "bull";
  const value = valueOfRound(target);

  const cells: readonly TargetCell[] = [
    isBull ? { kind: "bull" } : { kind: "number", wedge: target },
    { kind: "action", id: "miss", label: "MISS" },
  ];

  return (
    <View className="gap-app-md" style={{ width }}>
      <AppText className="text-center" color="mutedText" variant="caption">
        {`ROUND ${round}/${lastRound}`}
      </AppText>
      <AppText className="text-center" variant="hero">
        {isBull ? "D BULL" : `D${target}`}
      </AppText>
      <View className="flex-row justify-center gap-app-sm">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              backgroundColor: i < hits ? theme.colors.success : theme.colors.surfaceRaised,
              borderRadius: 999,
              height: 14,
              width: 14,
            }}
          />
        ))}
      </View>
      <AppText className="text-center" color="mutedText" variant="caption">
        {`+${value} / -${value}`}
      </AppText>

      <TargetBoard
        actionDart={() => MISS}
        cells={cells}
        columns={2}
        highlight={(cell) => {
          const hit = view.visit.darts.find((d) => {
            if (cell.kind === "action") return isMiss(d);
            if (!isBed(d)) return false;
            if (cell.kind === "bull") return d.ring === "outerBull" || d.ring === "innerBull";
            return "wedge" in d && d.wedge === cell.wedge;
          });
          return hit && !isMiss(hit) ? theme.colors.accent : null;
        }}
        onLand={onLand}
        onUpgrade={onUpgrade}
        toDart={(cellId, multiplier) => {
          if (cellId === 0) return multiplier === "single" ? OUTER_BULL : INNER_BULL;
          return { ring: multiplier, wedge: cellId as Wedge };
        }}
        width={width}
      />
    </View>
  );
}
