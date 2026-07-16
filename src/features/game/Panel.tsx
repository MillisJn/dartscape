import type { Dart } from "@/core/board";
import type { GameView } from "@/core/game/view";
import { Track } from "@/ui/board/aroundTheClock/Track";
import { Diamond } from "@/ui/board/baseball/Diamond";
import { BigDouble } from "@/ui/board/bobs27/BigDouble";
import { CricketGrid } from "@/ui/board/cricket/CricketGrid";
import type { CricketScoreFeedback } from "@/ui/board/cricket/scoreFeedback";
import { RoundsRow } from "@/ui/board/halveIt/RoundsRow";
import { KillerBoard } from "@/ui/board/killer/KillerBoard";
import { ClockFace } from "@/ui/board/shanghai/ClockFace";
import { ScoreGrid } from "@/ui/board/x01/ScoreGrid";

export interface PanelProps {
  readonly view: GameView;
  readonly width: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
  /** Cricket-only today: the merged sheet's miss/CAP feedback, for a sound trigger at
   * the features layer (ui/ can't reach effects/ directly — see layerBoundary.test.ts). */
  readonly onScoreFeedback?: (feedback: CricketScoreFeedback) => void;
}

/** One shell, eight panels — view(state) returns a discriminated panel, so this is the one place
 * that switches on it. */
export function Panel({ view, width, onLand, onUpgrade, onScoreFeedback }: PanelProps) {
  switch (view.panel.kind) {
    case "x01":
      return <ScoreGrid onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "cricket":
      return (
        <CricketGrid
          onLand={onLand}
          onScoreFeedback={onScoreFeedback}
          onUpgrade={onUpgrade}
          view={view}
          width={width}
        />
      );
    case "baseball":
      return <Diamond onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "shanghai":
      return <ClockFace onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "killer":
      return <KillerBoard onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "aroundTheClock":
      return <Track onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "halveIt":
      return <RoundsRow onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "bobs27":
      return <BigDouble onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
  }
}
