import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { bed, type Dart, isBed, isMiss, MISS, sameBed, type Wedge } from "@/core/board";
import type { GameView } from "@/core/game/view";

import { TargetBoard } from "../shared/TargetBoard";
import type { TargetCell } from "../shared/targetGrid";

export interface KillerBoardProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
}

const ALL_WEDGES = Array.from({ length: 20 }, (_, i) => (i + 1) as Wedge);
const CELLS: readonly TargetCell[] = [
  ...ALL_WEDGES.map((wedge): TargetCell => ({ kind: "number", wedge })),
  { kind: "action", id: "miss", label: "MISS" },
];

/** Killer: claim a number (any wedge, either phase — the claim/kill rule check is the engine's
 * job, not the board's), then earn the kill and take lives. Lives shown as pips, killer marked. */
export function KillerBoard({ view, width, onLand, onUpgrade }: KillerBoardProps) {
  const theme = useTheme();
  if (view.panel.kind !== "killer") return null;
  const { phase, seats } = view.panel;

  return (
    <View className="gap-app-md" style={{ width }}>
      <AppText className="text-center" color="mutedText" variant="caption">
        {phase === "claim" ? "CLAIM YOUR NUMBER" : "KILL"}
      </AppText>
      <View className="flex-row flex-wrap justify-center gap-app-md">
        {seats.map((seat, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: i is the seat number, a stable identity for the length of the game.
          <View className="items-center gap-app-xxs" key={i}>
            <AppText
              color={view.players[i]?.isThrowing ? "accent" : undefined}
              numberOfLines={1}
              variant="caption"
            >
              {view.players[i]?.name ?? ""}
            </AppText>
            <AppText variant="title">{seat.target ?? "—"}</AppText>
            <View className="flex-row gap-app-xxs">
              {Array.from({ length: seat.lives }, (_, j) => `${i}-life-${j}`).map((key) => (
                <View
                  key={key}
                  style={{
                    backgroundColor: theme.colors.success,
                    borderRadius: 999,
                    height: 8,
                    width: 8,
                  }}
                />
              ))}
            </View>
            {seat.isKiller ? <AppText variant="label">☠</AppText> : null}
          </View>
        ))}
      </View>

      <TargetBoard
        actionDart={() => MISS}
        cells={CELLS}
        columns={4}
        highlight={(cell) => {
          const hit = view.visit.darts.find((d) => {
            if (cell.kind === "action") return isMiss(d);
            if (!isBed(d) || cell.kind !== "number") return false;
            return sameBed(d, { ring: "single", wedge: cell.wedge });
          });
          return hit && !isMiss(hit) ? theme.colors.accent : null;
        }}
        onLand={onLand}
        onUpgrade={onUpgrade}
        toDart={(cellId, multiplier) => bed(multiplier, cellId as Wedge)}
        width={width}
      />
    </View>
  );
}
