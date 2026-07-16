import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { bed, type Dart, INNER_BULL, MISS, type Wedge } from "@/core/board";
import { HALVE_IT_ROUNDS } from "@/core/game/halveIt";
import type { GameView } from "@/core/game/view";
import type { Multiplier } from "../shared/dartGesture";
import { TargetBoard } from "../shared/TargetBoard";
import type { TargetCell } from "../shared/targetGrid";

export interface RoundsRowProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
}

const ALL_WEDGES = Array.from({ length: 20 }, (_, i) => (i + 1) as Wedge);

interface RoundInput {
  readonly cells: readonly TargetCell[];
  readonly columns: number;
  readonly toDart: (cellId: number, multiplier: Multiplier) => Dart;
  readonly actionDart: (id: string) => Dart;
}

function inputFor(target: (typeof HALVE_IT_ROUNDS)[number]): RoundInput {
  if (target.kind === "anyDouble" || target.kind === "anyTreble") {
    const fixedRing = target.kind === "anyDouble" ? "double" : "treble";
    return {
      cells: [
        ...ALL_WEDGES.map((w): TargetCell => ({ kind: "action", id: `w${w}`, label: String(w) })),
        { kind: "action", id: "miss", label: "MISS" },
      ],
      columns: 4,
      toDart: () => MISS, // never called — every cell here is an action cell
      actionDart: (id) => (id === "miss" ? MISS : bed(fixedRing, Number(id.slice(1)) as Wedge)),
    };
  }

  if (target.kind === "bull") {
    return {
      cells: [{ kind: "bull" }, { kind: "action", id: "miss", label: "MISS" }],
      columns: 2,
      toDart: (_cellId, multiplier) =>
        multiplier === "single" ? { ring: "outerBull" } : INNER_BULL,
      actionDart: () => MISS,
    };
  }

  const wedge = target.wedge;
  return {
    cells: [
      { kind: "number", wedge },
      { kind: "action", id: "miss", label: "MISS" },
    ],
    columns: 2,
    toDart: (cellId, multiplier) => ({ ring: multiplier, wedge: cellId as Wedge }),
    actionDart: () => MISS,
  };
}

/** Halve It: seven rounds. "Any double"/"any treble" rounds need a wedge picked at a fixed
 * multiplier (no escalation — the round already fixes it), everything else escalates normally. */
export function RoundsRow({ view, width, onLand, onUpgrade }: RoundsRowProps) {
  const theme = useTheme();
  if (view.panel.kind !== "halveIt") return null;
  const { target: label, round, lastRound, atRisk } = view.panel;
  const target = HALVE_IT_ROUNDS[view.round];
  if (!target) return null;

  const { cells, columns, toDart, actionDart } = inputFor(target);

  return (
    <View className="gap-app-md" style={{ width }}>
      <View className="flex-row items-center justify-center gap-app-sm">
        {HALVE_IT_ROUNDS.map((_, i) => i).map((i) => (
          <View
            key={`round-${i}`}
            style={{
              backgroundColor: i === view.round ? theme.colors.accent : theme.colors.border,
              borderRadius: 999,
              height: 10,
              width: 10,
            }}
          />
        ))}
      </View>
      <AppText
        className="text-center"
        variant="title"
      >{`ROUND ${round}/${lastRound} — ${label}`}</AppText>
      {atRisk ? (
        <AppText className="text-center" color="danger" variant="label">
          AT RISK
        </AppText>
      ) : null}

      <TargetBoard
        actionDart={actionDart}
        cells={cells}
        columns={columns}
        onLand={onLand}
        onUpgrade={onUpgrade}
        toDart={toDart}
        width={width}
      />
    </View>
  );
}
