import { Canvas, Circle, Group, matchFont, Text } from "@shopify/react-native-skia";
import { useTheme } from "@spatch-kit/theme/provider";
import { useMemo } from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { type Dart, isBed, isMiss, sameBed } from "@/core/board";
import type { GameView } from "@/core/game/view";
import { useDartGesture } from "../shared/useDartGesture";
import { x01GridLayout, x01GridRows } from "./hitTest";
import { x01HitTestAction, x01HitTestTarget } from "./x01Targets";

export interface ScoreGridProps {
  readonly view: GameView;
  readonly width: number;
  /** The instant single landing on press. */
  readonly onLand: (dart: Dart) => void;
  /** A double/treble upgrade — pops the previous dart, pushes this one. */
  readonly onUpgrade: (dart: Dart) => void;
}

/** Colour by multiplier — this visit's darts light their cell to confirm what landed. */
function highlightColor(dart: Dart, theme: ReturnType<typeof useTheme>): string | null {
  if (isMiss(dart)) return null;
  switch (dart.ring) {
    case "single":
    case "outerBull":
      return theme.colors.success;
    case "double":
      return theme.colors.accent;
    case "treble":
    case "innerBull":
      return theme.colors.warning;
  }
}

/**
 * The X01 grid: BUST, 1..20, BULL — the risk slice (Step 2). One Skia canvas, hit-tested by
 * hitTest.ts, driven by useDartGesture. Props only, no store (architecture rule 5) — features/
 * wires this to the real matchStore.
 */
export function ScoreGrid({ view, width, onLand, onUpgrade }: ScoreGridProps) {
  const theme = useTheme();
  const layout = useMemo(() => x01GridLayout(width), [width]);
  const height = useMemo(() => (width / 4) * x01GridRows(), [width]);
  const font = useMemo(
    () => matchFont({ fontFamily: theme.fonts.sansBold, fontSize: width / 4 / 3.2 }),
    [theme.fonts.sansBold, width],
  );

  const gesture = useDartGesture({
    hitTest: (point) => x01HitTestTarget(point, width),
    hitTestAction: (point) => x01HitTestAction(point, width),
    onLand,
    onUpgrade,
  });

  const visitDarts = view.visit.darts;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }}>
        <Canvas style={{ width, height }}>
          {layout.map(({ cell, cx, cy, radius }) => {
            const isBust = cell.kind === "bust";
            const strokeColor = isBust ? theme.colors.danger : theme.colors.text;
            const text = isBust ? "BUST" : cell.kind === "bull" ? "BULL" : String(cell.wedge);

            const hit = visitDarts.find((d) => {
              if (isBust) return isMiss(d);
              if (!isBed(d)) return false;
              if (cell.kind === "bull") return d.ring === "outerBull" || d.ring === "innerBull";
              return sameBed(d, { ring: "single", wedge: cell.wedge });
            });
            const glow = hit ? highlightColor(hit, theme) : null;

            const textWidth = font.measureText(text).width;
            const fontSize = width / 4 / 3.2;

            return (
              <Group key={`${cell.kind}-${"wedge" in cell ? cell.wedge : ""}`}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  color={glow ?? theme.colors.surfaceRaised}
                  style="fill"
                  opacity={glow ? 0.9 : 1}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  color={strokeColor}
                  style="stroke"
                  strokeWidth={2.5}
                />
                <Text
                  x={cx - textWidth / 2}
                  y={cy + fontSize / 3}
                  text={text}
                  font={font}
                  color={isBust ? theme.colors.danger : theme.colors.text}
                />
              </Group>
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}
