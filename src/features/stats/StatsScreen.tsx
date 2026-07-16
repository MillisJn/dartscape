import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Screen } from "@spatch-kit/ui/primitives/Screen";
import { SectionHeader } from "@spatch-kit/ui/primitives/SectionHeader";
import { SegmentedTabs } from "@spatch-kit/ui/primitives/SegmentedTabs";
import { SelectField } from "@spatch-kit/ui/primitives/SelectField";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { GAME_KINDS, type GameKind, type Player } from "@/core/game/config";
import { computeStats } from "@/core/stats/stats";
import type { SavedGame } from "@/core/store/repo";
import { getRepo } from "@/state/repoSeam";

import { catalogFor, UNIVERSAL_ROWS } from "./catalog";

type GameFilter = "all" | GameKind;

const GAME_TABS: Array<{ label: string; value: GameFilter }> = [
  { label: "ALL", value: "all" },
  ...GAME_KINDS.map((kind) => ({ label: kind.toUpperCase(), value: kind as GameFilter })),
];

/** A player picker + game filter, then the stats catalog — a projection over
 * computeStats(games, playerId), not logic of its own. */
export function StatsScreen() {
  const params = useLocalSearchParams<{ playerId?: string }>();
  const [players, setPlayers] = useState<readonly Player[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(params.playerId ?? null);
  const [filter, setFilter] = useState<GameFilter>("all");
  const [games, setGames] = useState<readonly SavedGame[]>([]);

  useEffect(() => {
    void getRepo()
      .allPlayers()
      .then((all) => {
        setPlayers(all);
        setPlayerId((current) => current ?? all[0]?.id ?? null);
      });
  }, []);

  useEffect(() => {
    if (!playerId) return;
    void getRepo().gamesFor(playerId).then(setGames);
  }, [playerId]);

  const filteredGames = useMemo(
    () => (filter === "all" ? games : games.filter((g) => g.config.kind === filter)),
    [games, filter],
  );

  const stats = playerId ? computeStats(filteredGames, playerId) : null;
  const rows = [...UNIVERSAL_ROWS, ...(filter === "all" ? [] : catalogFor(filter))];

  return (
    <Screen className="bg-background">
      <SectionHeader title="STATS" titleVariant="hero" />
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        <SelectField
          label="Player"
          onChange={setPlayerId}
          options={players.map((p) => ({ label: p.name, value: p.id }))}
          value={playerId ?? ""}
        />

        <SegmentedTabs onChange={setFilter} options={GAME_TABS} selectedValue={filter} />

        {stats ? (
          <View className="gap-app-sm">
            <View className="items-center gap-app-xxs border-b border-border pb-app-sm">
              <AppText color="mutedText" variant="caption">
                RATING
              </AppText>
              <AppText variant="hero">{stats.rating.toFixed(1)}</AppText>
            </View>
            {rows.map((row) => {
              const value = stats[row.key];
              const display =
                value === null
                  ? "—"
                  : typeof value === "number"
                    ? row.format
                      ? row.format(value)
                      : String(value)
                    : String(value);
              return (
                <View
                  className="flex-row justify-between border-b border-border py-app-xs"
                  key={row.key}
                >
                  <AppText color="mutedText" variant="body">
                    {row.label}
                  </AppText>
                  <AppText variant="body">{display}</AppText>
                </View>
              );
            })}
          </View>
        ) : (
          <AppText color="mutedText" variant="bodyMuted">
            No players yet — add one from the Players tab.
          </AppText>
        )}
      </ScrollView>
    </Screen>
  );
}
