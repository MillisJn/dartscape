import { bed, type Dart, INNER_BULL, MISS, OUTER_BULL } from "@/core/board";
import type { DartGestureTarget } from "../shared/useDartGesture";
import { type X01Cell, x01CellId, x01HitTest } from "./hitTest";

/**
 * Bridges hitTest.ts's pure geometry into useDartGesture's target/action shape, for the X01 grid
 * specifically. BUST is single-action (a miss, fired on release); numbers escalate single ->
 * double -> treble; BULL escalates outer -> inner (there's no third bull ring, so a "treble" emit
 * on bull's sentinel cell also resolves to inner bull — there's nowhere else for it to go).
 */

function targetFor(cell: X01Cell): DartGestureTarget | null {
  if (cell.kind === "bust") return null; // handled as an action, not an escalating target
  const cellId = x01CellId(cell);
  return {
    cellId,
    toDart(multiplier): Dart {
      if (cell.kind === "bull") {
        return multiplier === "single" ? OUTER_BULL : INNER_BULL;
      }
      return bed(multiplier, cell.wedge);
    },
  };
}

export function x01HitTestTarget(point: { readonly x: number; readonly y: number }, width: number) {
  const cell = x01HitTest(point, width);
  return cell ? targetFor(cell) : null;
}

export function x01HitTestAction(
  point: { readonly x: number; readonly y: number },
  width: number,
): Dart | null {
  const cell = x01HitTest(point, width);
  return cell?.kind === "bust" ? MISS : null;
}
