import type { Dart } from "@/core/board";
import type { GameEvent } from "@/core/game/events";
import type { GameView } from "@/core/game/view";
import { Track } from "@/ui/board/aroundTheClock/Track";
import { Diamond } from "@/ui/board/baseball/Diamond";
import { BigDouble } from "@/ui/board/bobs27/BigDouble";
import { CricketGrid } from "@/ui/board/cricket/CricketGrid";
import { RoundsRow } from "@/ui/board/halveIt/RoundsRow";
import { KillerBoard } from "@/ui/board/killer/KillerBoard";
import { ClockFace } from "@/ui/board/shanghai/ClockFace";
import { ScoreGrid } from "@/ui/board/x01/ScoreGrid";

export interface PanelProps {
  readonly view: GameView;
  readonly width: number;
  /** Available vertical space for the panel. Cricket uses it to fill the screen (one
   * packed, non-scrolling sheet); the other panels are width-driven and ignore it. */
  readonly height?: number;
  readonly onLand: (dart: Dart) => void;
  readonly onUpgrade: (dart: Dart) => void;
  /** The general "a dart just landed" feed (whoever threw it): the last dart, the events it
   * produced, and the log length as the change signal. A board turns these into feedback
   * (popup/flash) via useDartFeedback — cricket does today; other boards can adopt it. */
  readonly lastDart?: Dart | null;
  readonly events?: readonly GameEvent[];
  readonly dartCount?: number;
}

/** One shell, eight panels — view(state) returns a discriminated panel, so this is the one place
 * that switches on it. */
export function Panel({
  view,
  width,
  height,
  onLand,
  onUpgrade,
  lastDart,
  events,
  dartCount,
}: PanelProps) {
  switch (view.panel.kind) {
    case "x01":
      return <ScoreGrid onLand={onLand} onUpgrade={onUpgrade} view={view} width={width} />;
    case "cricket":
      return (
        <CricketGrid
          dartCount={dartCount ?? 0}
          events={events ?? []}
          height={height}
          lastDart={lastDart ?? null}
          onLand={onLand}
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
