import { Text, View } from "react-native";
import type { Dart } from "@/core/board";
import { CRICKET_TARGETS } from "@/core/game/cricket";
import type { GameView } from "@/core/game/view";
import { PALETTE } from "@/ui/theme/palette";

import { ScorePopupLayer } from "../shared/ScorePopup";
import { useScorePopups } from "../shared/useScorePopups";
import { CricketCellCanvas } from "./CricketCellCanvas";
import { cricketCellRect, cricketGridLayout } from "./cricketLayout";
import type { CricketScoreFeedback } from "./scoreFeedback";

export interface CricketGridProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
  /** Only miss/CAP feedback needs a sound trigger today (a normal score's sound
   * already fires from useGameEvents' dartScored case) — kept generic so other
   * panels' own redesign passes can adopt the same popup/flash system later. */
  readonly onScoreFeedback?: (feedback: CricketScoreFeedback) => void;
}

const ROW_LABELS = [...CRICKET_TARGETS.map((t) => (t === "bull" ? "BULL" : String(t))), "MISS"];

/** The merged cricket sheet — a mirrored grid of tally-mark columns (see
 * cricketGrid.ts) around a central number-label column, one Skia canvas per seat
 * (CricketCellCanvas). Replaces the old read-only sheet + separate TargetBoard
 * circle-row: this grid IS the tappable surface, exactly like the original. */
export function CricketGrid({ view, width, onLand, onUpgrade, onScoreFeedback }: CricketGridProps) {
  const { popups, show } = useScorePopups();
  if (view.panel.kind !== "cricket") return null;
  const { rows } = view.panel;

  const layout = cricketGridLayout(view.players.length, width);
  const dead = rows.map((r) => r.dead);

  const columnFor = (seat: number) => (
    <CricketCellCanvas
      active={view.players[seat]?.isThrowing ?? false}
      dead={dead}
      key={seat}
      layout={layout}
      marks={rows.map((r) => r.marks[seat] ?? 0)}
      onLand={onLand}
      onScored={(row, _dart, feedback) => {
        const rect = cricketCellRect(layout, seat, row);
        if (rect) show(feedback.text, feedback.color, rect);
        onScoreFeedback?.(feedback);
      }}
      onUpgrade={onUpgrade}
    />
  );

  return (
    <View style={{ height: layout.height, position: "relative", width }}>
      <View style={{ flexDirection: "row" }}>
        {layout.leftSeats.map(columnFor)}

        <View style={{ width: layout.labelColumnWidth }}>
          {ROW_LABELS.map((label) => (
            <View
              key={label}
              style={{ alignItems: "center", height: layout.cellHeight, justifyContent: "center" }}
            >
              <Text
                style={{
                  color: PALETTE.text,
                  fontSize: layout.cellHeight * 0.32,
                  fontWeight: "800",
                }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {layout.rightSeats.map(columnFor)}
      </View>

      <ScorePopupLayer popups={popups} />
    </View>
  );
}
