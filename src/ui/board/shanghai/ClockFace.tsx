import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { type Dart, INNER_BULL, isBed, isMiss, MISS, OUTER_BULL, type Wedge } from "@/core/board";
import type { GameView } from "@/core/game/view";

import { TargetBoard } from "../shared/TargetBoard";
import type { TargetCell } from "../shared/targetGrid";

export interface ClockFaceProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
}

/** Shanghai: one number a round. Hit single + double + treble of it in one visit and it's an
 * instant win. The clock face is simplified to this round's live target + a miss — see PLAN.md. */
export function ClockFace({ view, width, onLand, onUpgrade }: ClockFaceProps) {
  const theme = useTheme();
  if (view.panel.kind !== "shanghai") return null;
  const { target, round, lastRound } = view.panel;
  const isBull = target === "bull";

  const cells: readonly TargetCell[] = [
    isBull ? { kind: "bull" } : { kind: "number", wedge: target },
    { kind: "action", id: "miss", label: "MISS" },
  ];

  const rings = new Set(
    view.visit.darts
      .filter((d) => (isBull ? d.ring === "innerBull" : "wedge" in d && d.wedge === target))
      .map((d) => d.ring),
  );

  return (
    <View className="gap-app-md" style={{ width }}>
      <AppText className="text-center" color="mutedText" variant="caption">
        {`ROUND ${round}/${lastRound}`}
      </AppText>
      <View className="flex-row justify-center gap-app-sm">
        {(["single", "double", "treble"] as const).map((ring) => (
          <View
            key={ring}
            style={{
              backgroundColor: rings.has(ring) ? theme.colors.accent : theme.colors.surfaceRaised,
              borderRadius: 999,
              height: 14,
              width: 14,
            }}
          />
        ))}
      </View>

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
