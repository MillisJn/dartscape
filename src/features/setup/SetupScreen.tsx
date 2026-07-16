import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { BottomActionBar } from "@spatch-kit/ui/primitives/BottomActionBar";
import { BottomNavBar, type BottomNavItem } from "@spatch-kit/ui/primitives/BottomNavBar";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { CardSurface } from "@spatch-kit/ui/primitives/CardSurface";
import { Screen } from "@spatch-kit/ui/primitives/Screen";
import { SectionHeader } from "@spatch-kit/ui/primitives/SectionHeader";
import { SegmentedButtons } from "@spatch-kit/ui/primitives/SegmentedButtons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SKILL } from "@/core/bot/bot";
import { DEFAULT_CONFIG, type GameConfig, type GameKind } from "@/core/game/config";
import type { MatchFormat } from "@/core/match/match";
import { useMatchStore } from "@/state/matchStore";

import { GamePicker } from "./GamePicker";
import { catalogEntry } from "./gameCatalog";
import { OptionRows } from "./OptionRows";
import { type DraftPlayer, PlayerList } from "./PlayerList";

interface MatchFormatOption {
  readonly label: string;
  readonly value: string;
  readonly format: MatchFormat;
}

const MATCH_FORMATS: readonly MatchFormatOption[] = [
  { label: "SINGLE", value: "single", format: { kind: "single" } },
  { label: "RACE TO 3", value: "race3", format: { kind: "legRace", legs: 3 } },
  { label: "BEST OF 5/3", value: "bo53", format: { kind: "setMatch", legs: 5, sets: 3 } },
];

const DEFAULT_PLAYERS: readonly DraftPlayer[] = [
  { id: "you", name: "You", isBot: false, sigma: SKILL.NORMAL },
  { id: "bot-1", name: "Hard Bot", isBot: true, sigma: SKILL.HARD },
];

/**
 * The setup screen — pick a game, its options (generated from GameConfig's union — an illegal
 * combination can't even be rendered), the match format, and the roster, then start.
 */
export function SetupScreen() {
  const router = useRouter();
  const start = useMatchStore((s) => s.start);

  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG.x01);
  const [formatValue, setFormatValue] = useState<string>("single");
  const [players, setPlayers] = useState<readonly DraftPlayer[]>(DEFAULT_PLAYERS);
  const [pickerOpen, setPickerOpen] = useState(false);

  function selectGame(kind: GameKind) {
    setConfig(DEFAULT_CONFIG[kind]);
  }

  function startMatch() {
    const format = MATCH_FORMATS.find((f) => f.value === formatValue)?.format ?? { kind: "single" };
    const seated = players.map((p) => ({
      id: p.id,
      name: p.name,
      ...(p.isBot ? { sigma: p.sigma } : {}),
    }));
    start(config, seated, format);
    router.push("/game");
  }

  const entry = catalogEntry(config.kind);

  const navItems: BottomNavItem[] = [
    {
      key: "players",
      icon: "bot",
      label: "PLAYERS",
      active: false,
      onPress: () => router.push("/players"),
    },
    {
      key: "stats",
      icon: "trophy",
      label: "STATS",
      active: false,
      onPress: () => router.push("/stats"),
    },
    {
      key: "settings",
      icon: "settings",
      label: "SETTINGS",
      active: false,
      onPress: () => router.push("/settings"),
    },
  ];

  return (
    <Screen className="bg-background">
      <View className="flex-1">
        <SectionHeader
          title="DARTSCAPE"
          titleVariant="hero"
          trailing={<AppIcon name="bullseye" />}
        />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 96 }}>
          <CardSurface>
            <Button leadingIcon={entry.icon} onPress={() => setPickerOpen(true)} variant="ghost">
              {`${entry.label} › ${entry.hook}`}
            </Button>
          </CardSurface>

          <View className="gap-app-sm">
            <SectionHeader borderless title="OPTIONS" titleVariant="caption" />
            <OptionRows config={config} onChange={setConfig} />
          </View>

          <View className="gap-app-xs">
            <SectionHeader borderless title="MATCH" titleVariant="caption" />
            <SegmentedButtons
              onChange={setFormatValue}
              options={[...MATCH_FORMATS]}
              selectedValue={formatValue}
            />
          </View>

          <PlayerList onChange={setPlayers} players={players} />
        </ScrollView>
      </View>

      <BottomActionBar floating={false}>
        <Button
          className="flex-1"
          disabled={players.length === 0}
          onPress={startMatch}
          variant="primary"
        >
          START MATCH
        </Button>
      </BottomActionBar>
      <BottomNavBar items={navItems} />

      <GamePicker onClose={() => setPickerOpen(false)} onSelect={selectGame} visible={pickerOpen} />
    </Screen>
  );
}
