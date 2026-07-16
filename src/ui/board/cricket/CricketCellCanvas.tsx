import { BlurMask, Canvas, Circle, Group, Line } from "@shopify/react-native-skia";
import { useCallback, useMemo } from "react";
import { GestureDetector } from "react-native-gesture-handler";
import { bed, type Dart, INNER_BULL, isMiss, MISS, OUTER_BULL } from "@/core/board";
import { CRICKET_TARGETS, type CricketTarget, targetOf } from "@/core/game/cricket";
import { blendHex, disabledText, PALETTE } from "@/ui/theme/palette";
import type { Multiplier } from "../shared/dartGesture";
import { useCellAnimations } from "../shared/useCellAnimations";
import { ACTION_CELL, useDartGesture } from "../shared/useDartGesture";
import { type CricketGridLayout, cricketCellId, MISS_ROW_INDEX, TOTAL_ROWS } from "./cricketLayout";
import { cricketMarkerPaths } from "./cricketMarks";
import { type CricketScoreFeedback, cricketScoreFeedback } from "./scoreFeedback";

export interface CricketCellCanvasProps {
  /** Marks per row, CRICKET_TARGETS order (0-6) — length 7. */
  readonly marks: readonly number[];
  /** Closed by everyone, per row — length 7. */
  readonly dead: readonly boolean[];
  /** Only the throwing seat's column is gesture-enabled — every other column is
   * structurally untappable (hitTest/hitTestAction return null below), not just dim. */
  readonly active: boolean;
  readonly layout: CricketGridLayout;
  readonly onLand?: (dart: Dart) => void;
  readonly onUpgrade?: (dart: Dart) => void;
  /** Fired right after onLand/onUpgrade with the row + feedback text/color the caller
   * needs to position a floating popup and play a sound — see CricketGrid. */
  readonly onScored?: (row: number, dart: Dart, feedback: CricketScoreFeedback) => void;
}

const MARKER_RADIUS_FACTOR = 0.32;
const STROKE_FACTOR = 1 / 12;

function targetToDart(row: number, multiplier: Multiplier): Dart {
  const target = CRICKET_TARGETS[row];
  if (target === undefined) return MISS;
  if (target === "bull") return multiplier === "single" ? OUTER_BULL : INNER_BULL;
  return bed(multiplier, target);
}

/** One seat's column of the merged cricket sheet — a single Skia canvas so only the
 * active seat's column ever re-renders during a press/flash, and (when active) the
 * sole GestureDetector instance for its column, matching the original's per-cell
 * ScoreButton touch listener gated by isActive(). */
export function CricketCellCanvas({
  marks,
  dead,
  active,
  layout,
  onLand,
  onUpgrade,
  onScored,
}: CricketCellCanvasProps) {
  const animations = useCellAnimations();
  const { cellWidth: width, cellHeight } = layout;
  const height = cellHeight * TOTAL_ROWS;
  const strokeWidth = Math.min(width, cellHeight) * STROKE_FACTOR;
  const radius = Math.min(width, cellHeight) * MARKER_RADIUS_FACTOR;

  const rowAt = useCallback(
    (point: { readonly x: number; readonly y: number }): number | null => {
      if (point.y < 0 || point.y >= height) return null;
      const row = Math.floor(point.y / cellHeight);
      return row < 0 || row >= TOTAL_ROWS ? null : row;
    },
    [cellHeight, height],
  );

  const handleScore = useCallback(
    (dart: Dart) => {
      // Every non-miss dart reaching here was built by our own toDart(row, multiplier)
      // closure above, so it always resolves back to a valid CRICKET_TARGETS row.
      const row = isMiss(dart) ? MISS_ROW_INDEX : cricketCellId(targetOf(dart) as CricketTarget);
      const wasDead = row < MISS_ROW_INDEX && (dead[row] ?? false);
      const feedback = cricketScoreFeedback(dart, wasDead);
      animations.hitFlash(row, feedback.color);
      onScored?.(row, dart, feedback);
    },
    [animations, dead, onScored],
  );

  const gesture = useDartGesture({
    hitTest: (point) => {
      if (!active) return null;
      const row = rowAt(point);
      if (row === null || row === MISS_ROW_INDEX) return null;
      return { cellId: row, toDart: (multiplier) => targetToDart(row, multiplier) };
    },
    hitTestAction: (point) => {
      if (!active) return null;
      return rowAt(point) === MISS_ROW_INDEX ? MISS : null;
    },
    onLand: (dart) => {
      handleScore(dart);
      onLand?.(dart);
    },
    onUpgrade: (dart) => {
      handleScore(dart);
      onUpgrade?.(dart);
    },
    onPressStart: (cellId) => animations.lightUp(cellId === ACTION_CELL ? MISS_ROW_INDEX : cellId),
    onPressEnd: (cellId) => animations.lightDown(cellId === ACTION_CELL ? MISS_ROW_INDEX : cellId),
  });

  const baseColor = active ? PALETTE.text : disabledText();

  const rows = useMemo(() => Array.from({ length: TOTAL_ROWS }, (_, i) => i), []);

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width, height }}>
        {rows.map((row) => {
          const cy = row * cellHeight + cellHeight / 2;
          const cx = width / 2;
          const ratio = animations.ratioOf(row);
          const blendColor = animations.blendColorOf(row);
          const color = ratio > 0 ? blendHex(baseColor, blendColor, ratio) : baseColor;

          // The MISS row has no mark count of its own — just a plain dash, active
          // columns only (there's nothing to tap or show for an inactive seat there).
          const geometry =
            row === MISS_ROW_INDEX
              ? active
                ? cricketMarkerPaths(cx, cy, radius, 0)
                : null
              : cricketMarkerPaths(cx, cy, radius, marks[row] ?? 0);

          if (!geometry) return null;

          return (
            <Group key={row}>
              <Group>
                <BlurMask blur={strokeWidth} style="normal" />
                {geometry.dash ? (
                  <Line
                    color={PALETTE.textShadow}
                    p1={{ x: geometry.dash.x1, y: geometry.dash.y1 }}
                    p2={{ x: geometry.dash.x2, y: geometry.dash.y2 }}
                    strokeCap="round"
                    strokeWidth={strokeWidth}
                  />
                ) : null}
                {geometry.diagonal1 ? (
                  <Line
                    color={PALETTE.textShadow}
                    p1={{ x: geometry.diagonal1.x1, y: geometry.diagonal1.y1 }}
                    p2={{ x: geometry.diagonal1.x2, y: geometry.diagonal1.y2 }}
                    strokeCap="round"
                    strokeWidth={strokeWidth}
                  />
                ) : null}
                {geometry.diagonal2 ? (
                  <Line
                    color={PALETTE.textShadow}
                    p1={{ x: geometry.diagonal2.x1, y: geometry.diagonal2.y1 }}
                    p2={{ x: geometry.diagonal2.x2, y: geometry.diagonal2.y2 }}
                    strokeCap="round"
                    strokeWidth={strokeWidth}
                  />
                ) : null}
                {geometry.circle ? (
                  <Circle
                    color={PALETTE.textShadow}
                    cx={geometry.circle.cx}
                    cy={geometry.circle.cy}
                    r={geometry.circle.r}
                    strokeWidth={strokeWidth}
                    style="stroke"
                  />
                ) : null}
              </Group>

              {geometry.dash ? (
                <Line
                  color={color}
                  p1={{ x: geometry.dash.x1, y: geometry.dash.y1 }}
                  p2={{ x: geometry.dash.x2, y: geometry.dash.y2 }}
                  strokeCap="round"
                  strokeWidth={strokeWidth}
                />
              ) : null}
              {geometry.diagonal1 ? (
                <Line
                  color={color}
                  p1={{ x: geometry.diagonal1.x1, y: geometry.diagonal1.y1 }}
                  p2={{ x: geometry.diagonal1.x2, y: geometry.diagonal1.y2 }}
                  strokeCap="round"
                  strokeWidth={strokeWidth}
                />
              ) : null}
              {geometry.diagonal2 ? (
                <Line
                  color={color}
                  p1={{ x: geometry.diagonal2.x1, y: geometry.diagonal2.y1 }}
                  p2={{ x: geometry.diagonal2.x2, y: geometry.diagonal2.y2 }}
                  strokeCap="round"
                  strokeWidth={strokeWidth}
                />
              ) : null}
              {geometry.circle ? (
                <Circle
                  color={color}
                  cx={geometry.circle.cx}
                  cy={geometry.circle.cy}
                  r={geometry.circle.r}
                  strokeWidth={strokeWidth}
                  style="stroke"
                />
              ) : null}
            </Group>
          );
        })}
      </Canvas>
    </GestureDetector>
  );
}
