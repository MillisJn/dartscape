import type { Wedge } from "@/core/board";

/**
 * A generic point -> cell grid, for the five panels (Step 7) whose tappable surface is a short,
 * game-specific list of targets rather than X01's full 22-cell board: cricket's 7 targets + a
 * miss, killer's 20 wedges + a miss, baseball/shanghai/aroundTheClock's single live target (+
 * bull, + miss), halveIt's per-round target (a number, any-double, any-treble, or bull), Bob's
 * 27's per-round double. One layout function, shared, so every panel's hit-test and its drawing
 * agree by construction — same shape as hitTest.ts's X01-specific version.
 */

export type TargetCell =
  | { readonly kind: "number"; readonly wedge: Wedge; readonly label?: string }
  | { readonly kind: "bull" }
  /** Single-action: no escalation, fires directly on release (a miss/pass button). */
  | { readonly kind: "action"; readonly id: string; readonly label: string };

export interface TargetBounds {
  readonly cell: TargetCell;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

const RADIUS_FACTOR = 0.42;

/** Lays out `cells` in reading order, `columns` per row, square cells sized off the column
 * width — flowed top-down, the last row padded out however many cells remain. */
export function targetGridLayout(
  cells: readonly TargetCell[],
  width: number,
  columns: number,
): readonly TargetBounds[] {
  const cellSize = width / columns;
  const radius = cellSize * RADIUS_FACTOR;

  return cells.map((cell, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    return {
      cell,
      cx: col * cellSize + cellSize / 2,
      cy: row * cellSize + cellSize / 2,
      radius,
    };
  });
}

export function targetGridRows(cells: readonly TargetCell[], columns: number): number {
  return Math.ceil(cells.length / columns);
}

export function targetGridHitTest(
  cells: readonly TargetCell[],
  point: { readonly x: number; readonly y: number },
  width: number,
  columns: number,
): TargetCell | null {
  for (const bounds of targetGridLayout(cells, width, columns)) {
    const dx = point.x - bounds.cx;
    const dy = point.y - bounds.cy;
    if (dx * dx + dy * dy <= bounds.radius * bounds.radius) {
      return bounds.cell;
    }
  }
  return null;
}

/** The numeric id the gesture reducer escalates: a wedge (1-20), the bull sentinel 0, or -1 for
 * an action cell (which never reaches the reducer — see TargetBoard.tsx). */
export function targetCellId(cell: TargetCell): number {
  if (cell.kind === "number") return cell.wedge;
  if (cell.kind === "bull") return 0;
  return -1;
}
