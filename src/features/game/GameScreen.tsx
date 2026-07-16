import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Screen } from "@spatch-kit/ui/primitives/Screen";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { MISS } from "@/core/board";
import { nextSeating } from "@/core/match/match";
import { newId } from "@/core/newId";
import { computeStats, type Stats } from "@/core/stats/stats";
import type { SavedGame } from "@/core/store/repo";
import { playSound } from "@/effects/sound";
import { useGameEvents } from "@/effects/useGameEvents";
import { ResultsModal } from "@/features/results/ResultsModal";
import { useMatchStore } from "@/state/matchStore";
import { getRepo } from "@/state/repoSeam";
import { selectEvents, selectLiveStats, selectMatchState, selectView } from "@/state/selectors";
import { BOT_SPEED_MS, useSettingsStore } from "@/state/settingsStore";
import { GameControlBar, GameControlButton } from "@/ui/gameShell/GameControlBar";
import { GameTitleBar } from "@/ui/gameShell/GameTitleBar";
import { PlayerStrip, type PlayerStripEntry } from "@/ui/gameShell/PlayerStrip";
import { VisitStrip } from "@/ui/gameShell/VisitStrip";
import { PALETTE } from "@/ui/theme/palette";

import { Panel } from "./Panel";
import { useBotTurn } from "./useBotTurn";

const END_TURN_GUARD = 10;

interface FinishedLeg {
  readonly winnerSeat: number;
  readonly statsBySeat: readonly Stats[];
}

/**
 * The game shell: one PlayerStrip, one VisitStrip, one Panel (switched on view.panel.kind), one
 * BottomActionBar, and a ResultsModal that opens on the "won" event.
 */
export function GameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const storeState = useMatchStore((s) => s);
  const { config, log, players, throwDart, undo, startNextLeg } = storeState;
  const botSpeed = useSettingsStore((s) => s.botSpeed);
  const checkoutHintsEnabled = useSettingsStore((s) => s.checkoutHintsEnabled);

  const [finishedLeg, setFinishedLeg] = useState<FinishedLeg | null>(null);
  /** Measured height of the panel region — cricket fills it (see the render below). */
  const [panelHeight, setPanelHeight] = useState(0);

  const onWon = useCallback((winnerSeat: number) => {
    // Read fresh: the log at the moment of the winning dart, not whatever was closed over when
    // this callback was created.
    const state = useMatchStore.getState();
    if (!state.config) return;

    const snapshot: SavedGame = {
      id: newId(),
      config: state.config,
      players: state.players,
      log: state.log,
      winner: winnerSeat,
      playedAt: Date.now(),
      format: state.format,
    };
    void getRepo()
      .saveGame(snapshot)
      .catch((error: unknown) => console.error("saveGame failed", error));

    const winnerId = state.players[winnerSeat]?.id;
    if (winnerId) state.recordLegResult(winnerId);

    const statsBySeat = state.players.map((p) => computeStats([snapshot], p.id));
    setFinishedLeg({ winnerSeat, statsBySeat });
  }, []);

  const view = selectView(storeState);
  const events = selectEvents(storeState);

  useGameEvents(events, log.length, onWon);
  useBotTurn(config, players, log, throwDart, BOT_SPEED_MS[botSpeed]);

  function endTurn() {
    // Fill the rest of this visit with misses until the seat actually changes (or the game ends)
    // — the store can't tell that dart from a real one, which is exactly what makes this work for
    // every game's visit policy without special-casing any of them. Capped so a mis-modelled
    // engine-decided visit (baseball's three outs) can't spin forever.
    const seatBefore = selectView(useMatchStore.getState())?.visit.seat;
    if (seatBefore === undefined) return;

    let guard = 0;
    while (guard < END_TURN_GUARD) {
      const current = selectView(useMatchStore.getState());
      if (!current || current.winner !== null || current.visit.seat !== seatBefore) return;
      throwDart(MISS);
      guard++;
    }
  }

  function handleNextLeg() {
    const matchNow = selectMatchState(useMatchStore.getState());
    setFinishedLeg(null);
    if (matchNow.winner !== null) {
      router.back();
      return;
    }
    const ranking = [...players]
      .map((p, seat) => ({ p, seat }))
      .sort((a, b) =>
        a.seat === finishedLeg?.winnerSeat ? -1 : b.seat === finishedLeg?.winnerSeat ? 1 : 0,
      )
      .map(({ p }) => p.id);
    const seatedIds = nextSeating(
      "winnerFirst",
      players.map((p) => p.id),
      ranking,
    );
    const seated = seatedIds
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is (typeof players)[number] => p !== undefined);
    startNextLeg(seated);
  }

  if (!view || !config) {
    return (
      <Screen style={{ backgroundColor: PALETTE.screenBackground }}>
        <View className="flex-1 items-center justify-center">
          <AppText variant="bodyMuted">No match in progress.</AppText>
        </View>
      </Screen>
    );
  }

  const entries: PlayerStripEntry[] = view.players.map((p) => {
    const stats = selectLiveStats(storeState, p.seat);
    return {
      seat: p.seat,
      name: p.name,
      score: p.score,
      isBot: p.isBot,
      isThrowing: p.isThrowing,
      average: stats?.threeDartAverage ?? 0,
      checkout:
        checkoutHintsEnabled && view.panel.kind === "x01" && p.isThrowing
          ? view.panel.checkout
          : null,
    };
  });

  return (
    <Screen style={{ backgroundColor: PALETTE.screenBackground }}>
      <View className="flex-1">
        <GameTitleBar title={config.kind.toUpperCase()} />
        <PlayerStrip players={entries} />
        <VisitStrip darts={view.visit.darts} />
        {view.panel.kind === "cricket" ? (
          // Cricket fills the remaining space as one packed, non-scrolling sheet: measure
          // the leftover height and hand it to the panel so the rows grow to fit it.
          <View className="flex-1" onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}>
            <Panel
              height={panelHeight}
              onLand={throwDart}
              onScoreFeedback={(feedback) => {
                if (feedback.text === "MISS" || feedback.text === "CAP!") playSound("miss");
              }}
              onUpgrade={throwDart}
              view={view}
              width={width}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ alignItems: "center", padding: 8 }}>
            <Panel
              onLand={throwDart}
              onScoreFeedback={(feedback) => {
                if (feedback.text === "MISS" || feedback.text === "CAP!") playSound("miss");
              }}
              onUpgrade={throwDart}
              view={view}
              width={Math.min(width - 16, 420)}
            />
          </ScrollView>
        )}
      </View>

      <GameControlBar>
        <GameControlButton disabled={log.length === 0} label="UNDO" onPress={undo} />
        {view.panel.kind === "cricket" ? (
          // Cricket records a miss here rather than from a sheet row — see CricketGrid. The
          // miss sound rode on the old sheet row's feedback, so fire it here to keep parity.
          <GameControlButton
            label="MISS"
            onPress={() => {
              playSound("miss");
              throwDart(MISS);
            }}
          />
        ) : null}
        <GameControlButton label="END TURN" onPress={endTurn} />
      </GameControlBar>

      {finishedLeg ? (
        <ResultsModal
          kind={config.kind}
          matchState={selectMatchState(storeState)}
          onNextLeg={handleNextLeg}
          onViewResults={() => router.push("/stats")}
          players={players}
          statsBySeat={finishedLeg.statsBySeat}
          visible
          winnerSeat={finishedLeg.winnerSeat}
        />
      ) : null}
    </Screen>
  );
}
