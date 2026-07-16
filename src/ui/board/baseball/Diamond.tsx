import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { type Dart, INNER_BULL, isBed, isMiss, MISS, OUTER_BULL, type Wedge } from "@/core/board";
import type { GameView } from "@/core/game/view";

import { TargetBoard } from "../shared/TargetBoard";
import type { TargetCell } from "../shared/targetGrid";

export interface DiamondProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
}

/** Baseball: the inning is the number. Only that number (or the bull, a home run) scores; the
 * diamond shows bases/outs/runs, the board below is this inning's live target + a miss. */
export function Diamond({ view, width, onLand, onUpgrade }: DiamondProps) {
  const theme = useTheme();
  if (view.panel.kind !== "baseball") return null;
  const { inning, innings, outs, bases, runs, baseHits } = view.panel;

  const cells: readonly TargetCell[] = [
    { kind: "number", wedge: inning as Wedge },
    { kind: "bull" },
    { kind: "action", id: "out", label: "OUT" },
  ];

  return (
    <View className="gap-app-md" style={{ width }}>
      <View className="flex-row justify-between px-app-md">
        <View className="items-center">
          <AppText color="mutedText" variant="caption">
            RUNS
          </AppText>
          <AppText variant="hero">{runs}</AppText>
        </View>
        <View className="items-center">
          <AppText color="mutedText" variant="caption">
            {`INNING ${inning}/${innings}`}
          </AppText>
          <AppText variant="title">⧫</AppText>
        </View>
        <View className="items-center">
          <AppText color="mutedText" variant="caption">
            OUTS
          </AppText>
          <AppText variant="hero">{outs}</AppText>
        </View>
      </View>

      <View className="flex-row justify-center gap-app-md">
        {(["1ST", "2ND", "3RD"] as const).map((label, i) => (
          <View className="items-center gap-app-xxs" key={label}>
            <View
              style={{
                backgroundColor: bases[i + 1] ? theme.colors.accent : theme.colors.surfaceRaised,
                borderColor: theme.colors.text,
                borderWidth: 2,
                height: 20,
                transform: [{ rotate: "45deg" }],
                width: 20,
              }}
            />
            <AppText color="mutedText" variant="caption">
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <AppText className="text-center" color="mutedText" variant="caption">
        {`${baseHits} BASE HIT${baseHits === 1 ? "" : "S"} THIS AT-BAT`}
      </AppText>

      <TargetBoard
        actionDart={() => MISS}
        cells={cells}
        columns={3}
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
