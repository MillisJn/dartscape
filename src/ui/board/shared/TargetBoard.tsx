import { Canvas, Circle, Group, matchFont, Text } from "@shopify/react-native-skia";
import { useTheme } from "@spatch-kit/theme/provider";
import { useMemo } from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import type { Dart } from "@/core/board";

import type { Multiplier } from "./dartGesture";
import { type TargetCell, targetCellId, targetGridLayout, targetGridRows } from "./targetGrid";
import { useDartGesture } from "./useDartGesture";

export interface TargetBoardProps {
  readonly cells: readonly TargetCell[];
  readonly width: number;
  readonly columns: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
  /** For escalating (number/bull) cells: build the dart for a given cellId + multiplier. */
  readonly toDart: (cellId: number, multiplier: Multiplier) => Dart;
  /** For action cells: the dart to fire on release. */
  readonly actionDart: (id: string) => Dart;
  /** Highlight colour for a cell — e.g. this visit's darts, coloured by multiplier. */
  readonly highlight?: (cell: TargetCell) => string | null;
  /** Renders a cell's label; defaults to the cell's own label/wedge/"BULL". */
  readonly labelFor?: (cell: TargetCell) => string;
}

function defaultLabel(cell: TargetCell): string {
  if (cell.kind === "action") return cell.label;
  if (cell.kind === "bull") return "BULL";
  return cell.label ?? String(cell.wedge);
}

/**
 * The shared Skia input surface for Step 7's five simpler panels (cricket, baseball, shanghai,
 * aroundTheClock, halveIt, Bob's 27, killer) — a short list of tappable targets rather than X01's
 * full 22-cell board. Same mechanism as ScoreGrid.tsx (hit-test + useDartGesture), generalised
 * over an arbitrary cell list so each panel only supplies its own targets and dart mapping.
 */
export function TargetBoard({
  cells,
  width,
  columns,
  onLand,
  onUpgrade,
  toDart,
  actionDart,
  highlight,
  labelFor = defaultLabel,
}: TargetBoardProps) {
  const theme = useTheme();
  const layout = useMemo(() => targetGridLayout(cells, width, columns), [cells, width, columns]);
  const height = useMemo(
    () => (width / columns) * targetGridRows(cells, columns),
    [cells, width, columns],
  );
  const fontSize = width / columns / 3.2;
  const font = useMemo(
    () => matchFont({ fontFamily: theme.fonts.sansBold, fontSize }),
    [theme.fonts.sansBold, fontSize],
  );

  const gesture = useDartGesture({
    hitTest: (point) => {
      for (const bounds of layout) {
        if (bounds.cell.kind === "action") continue;
        const dx = point.x - bounds.cx;
        const dy = point.y - bounds.cy;
        if (dx * dx + dy * dy > bounds.radius * bounds.radius) continue;
        const cellId = targetCellId(bounds.cell);
        return { cellId, toDart: (m) => toDart(cellId, m) };
      }
      return null;
    },
    hitTestAction: (point) => {
      for (const bounds of layout) {
        if (bounds.cell.kind !== "action") continue;
        const dx = point.x - bounds.cx;
        const dy = point.y - bounds.cy;
        if (dx * dx + dy * dy <= bounds.radius * bounds.radius) {
          return actionDart(bounds.cell.id);
        }
      }
      return null;
    },
    onLand,
    onUpgrade,
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }}>
        <Canvas style={{ width, height }}>
          {layout.map((bounds) => {
            const { cell, cx, cy, radius } = bounds;
            const isAction = cell.kind === "action";
            const strokeColor = isAction ? theme.colors.danger : theme.colors.text;
            const text = labelFor(cell);
            const glow = highlight?.(cell) ?? null;
            const textWidth = font.measureText(text).width;

            return (
              <Group key={isAction ? cell.id : cell.kind === "bull" ? "bull" : cell.wedge}>
                <Circle
                  color={glow ?? theme.colors.surfaceRaised}
                  cx={cx}
                  cy={cy}
                  opacity={glow ? 0.9 : 1}
                  r={radius}
                  style="fill"
                />
                <Circle
                  color={strokeColor}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  strokeWidth={2.5}
                  style="stroke"
                />
                <Text
                  color={isAction ? theme.colors.danger : theme.colors.text}
                  font={font}
                  text={text}
                  x={cx - textWidth / 2}
                  y={cy + fontSize / 3}
                />
              </Group>
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
