import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { type Dart, isMiss } from "@/core/board";
import { CRICKET_TARGETS, targetOf } from "@/core/game/cricket";
import type { GameEvent } from "@/core/game/events";
import type { GameView } from "@/core/game/view";
import { PALETTE } from "@/ui/theme/palette";

import { ScorePopupLayer } from "../shared/ScorePopup";
import { useDartFeedback } from "../shared/useDartFeedback";
import { useScorePopups } from "../shared/useScorePopups";
import { CricketCellCanvas } from "./CricketCellCanvas";
import { cricketCellId, cricketCellRect, cricketColumnX, cricketGridLayout } from "./cricketLayout";
import { cricketFeedbackFromEvents } from "./scoreFeedback";

const SHADE_FADE_MS = 280;
const SLIDE_MS = 220;

/** A sliding highlight element for the throwing seat's column — slides to the next player's
 * column on a turn change (`x` is that column's left edge). Used twice: a lit FILL behind the
 * marks, and a white BORDER on top of the closed-row shading (so the selection border stays crisp
 * even where the row is greyed out). */
function SlidingColumn({
  x,
  width,
  height,
  motionEnabled,
  style,
}: {
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly motionEnabled: boolean;
  readonly style: object;
}) {
  const translateX = useRef(new Animated.Value(x)).current;
  useEffect(() => {
    if (!motionEnabled) {
      translateX.setValue(x);
      return;
    }
    Animated.timing(translateX, {
      toValue: x,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [x, motionEnabled, translateX]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { height, left: 0, position: "absolute", top: 0, transform: [{ translateX }], width },
        style,
      ]}
    />
  );
}

/** A closed (dead) row's shade — a translucent overlay across the WHOLE line (the active column
 * included, so a dead number still reads as dead for the current player) that fades in when the
 * number closes. The selection's white border draws on top of this, so only that border stays lit. */
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
  /** The general "a dart just landed" feed (see Panel / useDartFeedback) — drives the popup and
   * cell flash for EVERY dart: a human tap, a bot's throw, or the MISS button, all the same. */
  readonly lastDart: Dart | null;
  readonly events: readonly GameEvent[];
  readonly dartCount: number;
}

const ROW_LABELS = CRICKET_TARGETS.map((t) => (t === "bull" ? "BULL" : String(t)));

interface CellFlash {
  readonly seat: number;
  readonly row: number;
  readonly color: string;
  readonly seq: number;
}

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
  lastDart,
  events,
  dartCount,
}: CricketGridProps) {
  const { popups, show } = useScorePopups();
  const motionEnabled = useTheme().motion.enabled;
  const [flash, setFlash] = useState<CellFlash | null>(null);
  const flashSeqRef = useRef(0);

  const layout = useMemo(
    () => cricketGridLayout(view.players.length, width, height),
    [view.players.length, width, height],
  );

  // The general trigger: one popup (and, for a real cell, one flash) per dart, keyed off the
  // events it produced — identical for a human, a bot, or the MISS button.
  const onDart = useCallback(
    (dart: Dart, dartEvents: readonly GameEvent[]) => {
      const feedback = cricketFeedbackFromEvents(dart, dartEvents);
      if (feedback.seat === null) return;
      const seat = feedback.seat;

      const target = isMiss(dart) ? null : targetOf(dart);
      if (target === null) {
        // A miss (the MISS button, or a bed off the cricket sheet): float it up from the bottom
        // center of the sheet — right over the MISS button in the control bar below. Nothing to
        // flash (no cell was hit).
        show(feedback.text, feedback.color, {
          height: layout.cellHeight,
          width: layout.cellWidth,
          x: (width - layout.cellWidth) / 2,
          y: layout.height - layout.cellHeight,
        });
        return;
      }

      const row = cricketCellId(target);
      const rect = cricketCellRect(layout, seat, row);
      if (rect) show(feedback.text, feedback.color, rect);
      flashSeqRef.current += 1;
      setFlash({ color: feedback.color, row, seat, seq: flashSeqRef.current });
    },
    [layout, show, width],
  );

  useDartFeedback(dartCount, { dart: lastDart, events }, onDart);

  if (view.panel.kind !== "cricket") return null;
  const { rows } = view.panel;
  const dead = rows.map((r) => r.dead);

  // The throwing seat's column gets the sliding highlight (human or bot — it shows whose turn it
  // is). Tapping is enabled only for a HUMAN thrower, so a stray tap can't score for the bot.
  const throwingSeat = view.players.findIndex((p) => p.isThrowing);
  const activeColumnX = throwingSeat >= 0 ? cricketColumnX(layout, throwingSeat) : null;

  const columnFor = (seat: number) => {
    const player = view.players[seat];
    const tappable = (player?.isThrowing ?? false) && !(player?.isBot ?? false);
    // Pass the flash state object as-is (stable identity until the next dart) so the cell only
    // re-flashes when a new dart actually lands on it.
    const seatFlash = flash && flash.seat === seat ? flash : null;
    return (
      <CricketCellCanvas
        active={tappable}
        flash={seatFlash}
        key={seat}
        layout={layout}
        marks={rows.map((r) => r.marks[seat] ?? 0)}
        onLand={onLand}
        onUpgrade={onUpgrade}
      />
    );
  };

  return (
    <View style={{ height: layout.height, position: "relative", width }}>
      {/* Behind the marks: the active seat's lit column fill (slides between players). */}
      {activeColumnX !== null ? (
        <SlidingColumn
          height={layout.height}
          motionEnabled={motionEnabled}
          style={{ backgroundColor: PALETTE.activeHighlight }}
          width={layout.cellWidth}
          x={activeColumnX}
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

      {/* On top of the marks: a fade-in shade over each closed row — the whole line, active column
          included. Rows are snapped to whole pixels (top/bottom rounded) so neighbouring shades
          meet exactly, with no hairline of un-shaded cell bleeding through fractional edges. */}
      {dead.map((isDead, i) => {
        if (!isDead) return null;
        const top = Math.round(i * layout.cellHeight);
        const bottom = Math.round((i + 1) * layout.cellHeight);
        return (
          <RowShade
            height={bottom - top}
            key={ROW_LABELS[i]}
            motionEnabled={motionEnabled}
            top={top}
            width={Math.round(width)}
          />
        );
      })}

      {/* On top of the shade: the selection's white border, so it stays crisp over dead rows. No
          top border — it would double up against the visit strip and reads as continuing upward. */}
      {activeColumnX !== null ? (
        <SlidingColumn
          height={layout.height}
          motionEnabled={motionEnabled}
          style={{
            borderBottomWidth: 2,
            borderColor: PALETTE.divider,
            borderLeftWidth: 2,
            borderRightWidth: 2,
          }}
          width={layout.cellWidth}
          x={activeColumnX}
        />
      ) : null}

      <ScorePopupLayer popups={popups} />
    </View>
  );
}
