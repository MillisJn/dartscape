import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import type { Dart } from "@/core/board";
import { CRICKET_TARGETS } from "@/core/game/cricket";
import type { GameView } from "@/core/game/view";
import { PALETTE } from "@/ui/theme/palette";

import { ScorePopupLayer } from "../shared/ScorePopup";
import { useScorePopups } from "../shared/useScorePopups";
import { CricketCellCanvas } from "./CricketCellCanvas";
import { cricketCellRect, cricketColumnX, cricketGridLayout } from "./cricketLayout";
import type { CricketScoreFeedback } from "./scoreFeedback";

const SHADE_FADE_MS = 280;

/** A closed (dead) row's shade — a translucent overlay across the whole line that fades in
 * so a number visibly "goes out" the moment it closes, rather than snapping to shaded. */
function RowShade({
  top,
  width,
  height,
  motionEnabled,
}: {
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly motionEnabled: boolean;
}) {
  const opacity = useRef(new Animated.Value(motionEnabled ? 0 : 1)).current;
  useEffect(() => {
    if (!motionEnabled) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: SHADE_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [motionEnabled, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        backgroundColor: PALETTE.closedShade,
        height,
        left: 0,
        opacity,
        position: "absolute",
        top,
        width,
      }}
    />
  );
}

export interface CricketGridProps {
  readonly view: GameView;
  readonly width: number;
  /** Available vertical space — the sheet fills it so it fits on one screen (no scroll)
   * and the rows stay big even at 4 players. Omitted falls back to width-derived rows. */
  readonly height?: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
  /** Only miss/CAP feedback needs a sound trigger today (a normal score's sound
   * already fires from useGameEvents' dartScored case) — kept generic so other
   * panels' own redesign passes can adopt the same popup/flash system later. */
  readonly onScoreFeedback?: (feedback: CricketScoreFeedback) => void;
}

const ROW_LABELS = CRICKET_TARGETS.map((t) => (t === "bull" ? "BULL" : String(t)));

/** The merged cricket sheet — a mirrored grid of tally-mark columns (see
 * cricketGrid.ts) around a central number-label column, one Skia canvas per seat
 * (CricketCellCanvas). Replaces the old read-only sheet + separate TargetBoard
 * circle-row: this grid IS the tappable surface, exactly like the original. */
export function CricketGrid({
  view,
  width,
  height,
  onLand,
  onUpgrade,
  onScoreFeedback,
}: CricketGridProps) {
  const { popups, show } = useScorePopups();
  const motionEnabled = useTheme().motion.enabled;
  if (view.panel.kind !== "cricket") return null;
  const { rows } = view.panel;

  const layout = cricketGridLayout(view.players.length, width, height);
  const dead = rows.map((r) => r.dead);

  // The throwing seat's column gets a lit highlight box (fill + border) spanning the whole
  // sheet — that's how the active player is shown, instead of dimming everyone else.
  const activeSeat = view.players.findIndex((p) => p.isThrowing);
  const activeColumnX = activeSeat >= 0 ? cricketColumnX(layout, activeSeat) : null;

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
      {/* Behind the marks: the active seat's lit column. */}
      {activeColumnX !== null ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: PALETTE.activeHighlight,
            borderColor: PALETTE.divider,
            borderWidth: 2,
            height: layout.height,
            left: activeColumnX,
            position: "absolute",
            top: 0,
            width: layout.cellWidth,
          }}
        />
      ) : null}

      <View style={{ flexDirection: "row" }}>
        {layout.leftSeats.map(columnFor)}

        <View style={{ width: layout.labelColumnWidth }}>
          {ROW_LABELS.map((rowLabel, i) => (
            <View
              key={rowLabel}
              style={{ alignItems: "center", height: layout.cellHeight, justifyContent: "center" }}
            >
              {CRICKET_TARGETS[i] === "bull" ? (
                <AppIcon color={PALETTE.text} name="bullseye" size={layout.cellHeight * 0.55} />
              ) : (
                <Text
                  style={{
                    color: PALETTE.text,
                    fontSize: layout.cellHeight * 0.45,
                    fontWeight: "800",
                  }}
                >
                  {rowLabel}
                </Text>
              )}
            </View>
          ))}
        </View>

        {layout.rightSeats.map(columnFor)}
      </View>

      {/* On top of the marks: a fade-in shade over each closed row (whole line). */}
      {dead.map((isDead, i) =>
        isDead ? (
          <RowShade
            height={layout.cellHeight}
            key={ROW_LABELS[i]}
            motionEnabled={motionEnabled}
            top={i * layout.cellHeight}
            width={width}
          />
        ) : null,
      )}

      <ScorePopupLayer popups={popups} />
    </View>
  );
}
