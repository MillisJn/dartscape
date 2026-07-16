import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { View } from "react-native";
import type { GameKind, Player } from "@/core/game/config";
import { describeFormat, type MatchState } from "@/core/match/match";
import type { Stats } from "@/core/stats/stats";
import { catalogFor, UNIVERSAL_ROWS } from "@/features/stats/catalog";

export interface ResultsModalProps {
  readonly visible: boolean;
  readonly kind: GameKind;
  readonly winnerSeat: number;
  readonly players: readonly Player[];
  /** This leg's stats, one entry per seat — computeStats([finishedLeg], player.id). */
  readonly statsBySeat: readonly Stats[];
  readonly matchState: MatchState;
  readonly onViewResults: () => void;
  readonly onNextLeg: () => void;
}

function formatCell(
  row: { key: keyof Stats; format?: (v: number) => string },
  stats: Stats,
): string {
  const value = stats[row.key];
  if (value === null) return "—";
  if (typeof value !== "number") return String(value);
  return row.format ? row.format(value) : String(value);
}

/** Fires on the "won" event. computeStats([game], playerId) is why this is nearly free. */
export function ResultsModal({
  visible,
  kind,
  winnerSeat,
  players,
  statsBySeat,
  matchState,
  onViewResults,
  onNextLeg,
}: ResultsModalProps) {
  const winner = players[winnerSeat];
  const rows = [...UNIVERSAL_ROWS, ...catalogFor(kind)];
  const matchOver = matchState.winner !== null;

  return (
    <AppModal centered onClose={onNextLeg} title="RESULTS" visible={visible}>
      <View className="gap-app-md p-app-md">
        <View className="items-center gap-app-xxs">
          <AppText variant="hero">🏆</AppText>
          <AppText variant="title">{`${winner?.name.toUpperCase() ?? ""} WINS THE LEG`}</AppText>
          {matchOver ? (
            <AppText
              color="accent"
              variant="label"
            >{`${describeFormat(matchState.format)} — MATCH WON`}</AppText>
          ) : null}
        </View>

        <View className="flex-row border-b border-border pb-app-xs">
          <View className="flex-1" />
          {players.map((p) => (
            <AppText className="flex-1 text-center" key={p.id} numberOfLines={1} variant="label">
              {p.name}
            </AppText>
          ))}
        </View>

        {rows.map((row) => (
          <View className="flex-row items-center" key={row.key}>
            <AppText className="flex-1" color="mutedText" variant="caption">
              {row.label}
            </AppText>
            {players.map((p, seat) => {
              const stats = statsBySeat[seat];
              return (
                <AppText className="flex-1 text-center" key={p.id} variant="body">
                  {stats ? formatCell(row, stats) : "—"}
                </AppText>
              );
            })}
          </View>
        ))}

        <View className="flex-row gap-app-sm pt-app-sm">
          <Button className="flex-1" onPress={onViewResults} variant="ghost">
            RESULTS
          </Button>
          <Button className="flex-1" onPress={onNextLeg} variant="primary">
            {matchOver ? "DONE" : "NEXT LEG →"}
          </Button>
        </View>
      </View>
    </AppModal>
  );
}
