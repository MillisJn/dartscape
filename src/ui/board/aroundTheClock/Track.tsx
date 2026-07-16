import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { type Dart, INNER_BULL, isBed, isMiss, MISS, OUTER_BULL, type Wedge } from "@/core/board";
import type { Target } from "@/core/game/events";
import type { GameView } from "@/core/game/view";

import { TargetBoard } from "../shared/TargetBoard";
import type { TargetCell } from "../shared/targetGrid";

export interface TrackProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
}

/** Progress along the 1..20(+bull) sequence, as a fraction of the way home. */
function progressOf(target: Target | null): number {
  if (target === null) return 0;
  const position = target === "bull" ? 20 : target;
  return (position - 1) / 20;
}

/** Around the Clock: race 1 -> 20 (+ the bull) in order. Everyone's token shows what they're
 * chasing; the board is the throwing seat's live target + a miss. */
export function Track({ view, width, onLand, onUpgrade }: TrackProps) {
  const theme = useTheme();
  if (view.panel.kind !== "aroundTheClock") return null;
  const { on } = view.panel;
  const target = on[view.visit.seat] ?? null;
  if (target === null) return null;
  const isBull = target === "bull";

  const cells: readonly TargetCell[] = [
    isBull ? { kind: "bull" } : { kind: "number", wedge: target },
    { kind: "action", id: "miss", label: "MISS" },
  ];

  return (
    <View className="gap-app-md" style={{ width }}>
      <View className="gap-app-xs">
        {view.players.map((p) => (
          <View className="flex-row items-center gap-app-sm" key={p.seat}>
            <AppText className="w-[80px]" numberOfLines={1} variant="caption">
              {p.name}
            </AppText>
            <View
              className="h-[6px] flex-1 rounded-app-pill"
              style={{ backgroundColor: theme.colors.border }}
            >
              <View
                style={{
                  backgroundColor: p.isThrowing ? theme.colors.accent : theme.colors.mutedText,
                  borderRadius: 999,
                  height: 6,
                  width: 8,
                  marginLeft: `${progressOf(on[p.seat] ?? null) * 100}%`,
                }}
              />
            </View>
          </View>
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
