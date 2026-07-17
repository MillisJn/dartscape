import { BlurMask, Canvas, Circle, Group, Line } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo } from "react";
import { GestureDetector } from "react-native-gesture-handler";
import { bed, type Dart, INNER_BULL, MISS, OUTER_BULL } from "@/core/board";
import { CRICKET_TARGETS } from "@/core/game/cricket";
import { blendHex, PALETTE } from "@/ui/theme/palette";
import type { Multiplier } from "../shared/dartGesture";
import { useCellAnimations } from "../shared/useCellAnimations";
import { useDartGesture } from "../shared/useDartGesture";
import { type CricketGridLayout, TOTAL_ROWS } from "./cricketLayout";
import { cricketMarkerPaths } from "./cricketMarks";

export interface CricketCellCanvasProps {
  /** Marks per row, CRICKET_TARGETS order (0-6) — length 7. */
  readonly marks: readonly number[];
  /** Only the throwing seat's (human) column is gesture-enabled — every other column is
   * structurally untappable (hitTest returns null below), not just dim. */
  readonly active: boolean;
  readonly layout: CricketGridLayout;
  readonly onLand?: (dart: Dart) => void;
  readonly onUpgrade?: (dart: Dart) => void;
  /** The hit-flash to play on this column, or null. Driven by the shared dart feed (CricketGrid),
   * so a bot's dart flashes its cell exactly like a human's. `seq` re-triggers it per dart. */
  readonly flash?: { readonly row: number; readonly color: string; readonly seq: number } | null;
}

const MARKER_RADIUS_FACTOR = 0.32;
const STROKE_FACTOR = 1 / 12;
/** The empty-cell dash is drawn a bit thicker than the tally strokes — a chunkier bar reads
 * better as "nothing here yet" than a thin line (the original drew it as a filled rect). Its
 * blurred shadow stays at the normal stroke, so a thick bar doesn't cast a heavy black band. */
const EMPTY_DASH_STROKE_FACTOR = 1.4;

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
  active,
  layout,
  onLand,
  onUpgrade,
  flash,
}: CricketCellCanvasProps) {
  const animations = useCellAnimations();
  const { cellWidth: width, cellHeight } = layout;
  const height = cellHeight * TOTAL_ROWS;
  const strokeWidth = Math.min(width, cellHeight) * STROKE_FACTOR;
  const dashStroke = strokeWidth * EMPTY_DASH_STROKE_FACTOR;
  const radius = Math.min(width, cellHeight) * MARKER_RADIUS_FACTOR;

  const rowAt = useCallback(
    (point: { readonly x: number; readonly y: number }): number | null => {
      if (point.y < 0 || point.y >= height) return null;
      const row = Math.floor(point.y / cellHeight);
      return row < 0 || row >= TOTAL_ROWS ? null : row;
    },
    [cellHeight, height],
  );

  // The colored hit-flash is driven by the shared dart feed (any dart, any thrower) rather than
  // the tap itself: `flash` gets a fresh object once per dart landing on this column, so this
  // fires exactly once per dart (its `seq` also guarantees a distinct identity even for repeats).
  const { hitFlash } = animations;
  useEffect(() => {
    if (flash) hitFlash(flash.row, flash.color);
  }, [flash, hitFlash]);

  const gesture = useDartGesture({
    hitTest: (point) => {
      if (!active) return null;
      const row = rowAt(point);
      if (row === null) return null;
      return { cellId: row, toDart: (multiplier) => targetToDart(row, multiplier) };
    },
    // Cricket has no in-sheet action cell — a miss is the bottom bar's MISS button now.
    hitTestAction: () => null,
    onLand: (dart) => onLand?.(dart),
    onUpgrade: (dart) => onUpgrade?.(dart),
    // The whole white glow fires on touch-down and completes on its own, so a quick tap still
    // plays the full up-and-down before the colored hit-flash — no release-tied light-down.
    onPressStart: (cellId) => animations.pulse(cellId),
  });

  // Every column draws at full brightness — the active seat is shown by a lit highlight box
  // around its column (see CricketGrid), not by dimming everyone else.
  const baseColor = PALETTE.text;

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
          // The blurred shadow behind each mark blends toward the same white/color as the mark —
          // that glowing halo IS the press/hit feedback (a static black shadow shows no glow at all,
          // which is why the light-up looked invisible before). Ported from ScoreButton's
          // getShadowColor(blend).
          const shadowColor =
            ratio > 0 ? blendHex(PALETTE.textShadow, blendColor, ratio) : PALETTE.textShadow;

          const geometry = cricketMarkerPaths(cx, cy, radius, marks[row] ?? 0);

          if (!geometry) return null;

          return (
            <Group key={row}>
              <Group>
                <BlurMask blur={strokeWidth} style="normal" />
                {geometry.dash ? (
                  <Line
                    color={shadowColor}
                    p1={{ x: geometry.dash.x1, y: geometry.dash.y1 }}
                    p2={{ x: geometry.dash.x2, y: geometry.dash.y2 }}
                    strokeCap="round"
                    strokeWidth={strokeWidth}
                  />
                ) : null}
                {geometry.diagonal1 ? (
                  <Line
                    color={shadowColor}
                    p1={{ x: geometry.diagonal1.x1, y: geometry.diagonal1.y1 }}
                    p2={{ x: geometry.diagonal1.x2, y: geometry.diagonal1.y2 }}
                    strokeCap="round"
                    strokeWidth={strokeWidth}
                  />
                ) : null}
                {geometry.diagonal2 ? (
                  <Line
                    color={shadowColor}
                    p1={{ x: geometry.diagonal2.x1, y: geometry.diagonal2.y1 }}
                    p2={{ x: geometry.diagonal2.x2, y: geometry.diagonal2.y2 }}
                    strokeCap="round"
                    strokeWidth={strokeWidth}
                  />
                ) : null}
                {geometry.circle ? (
                  <Circle
                    color={shadowColor}
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
                  strokeWidth={dashStroke}
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
