import type { Wedge } from "@/core/board";

/**
 * Point -> cell, for the X01 grid. PURE geometry, same shape as core/board.test.ts's approach to
 * board geometry — testable with no render, no Skia, no device.
 *
 * The grid (Screenshot_4.jpg): BUST, 1..20, BULL — 22 circles, 4 per row, the last row holding
 * just 20 and BULL. One layout function is the single source of truth for both hit-testing here
 * and drawing in ScoreGrid.tsx, so the two can never drift apart.
 */

export type X01Cell =
  | { readonly kind: "number"; readonly wedge: Wedge }
  | { readonly kind: "bust" }
  | { readonly kind: "bull" };

export interface CellBounds {
  readonly cell: X01Cell;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

const COLUMNS = 4;
/** How much of a grid cell's half-width the tappable circle actually fills. */
const RADIUS_FACTOR = 0.42;

const ORDERED_CELLS: readonly X01Cell[] = [
  { kind: "bust" },
  ...Array.from({ length: 20 }, (_, i) => ({ kind: "number", wedge: (i + 1) as Wedge }) as const),
  { kind: "bull" },
];

/**
 * Lays out the grid's cells within `width` — square cells sized off the column width, flowed
 * top-down in reading order. `height` isn't used for sizing (cells are always square, matching
 * the screenshot); a caller that needs the total content height can multiply cellSize by the
 * number of rows this function implies.
 */
export function x01GridLayout(width: number): readonly CellBounds[] {
  const cellSize = width / COLUMNS;
  const radius = cellSize * RADIUS_FACTOR;

  return ORDERED_CELLS.map((cell, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    return {
      cell,
      cx: col * cellSize + cellSize / 2,
      cy: row * cellSize + cellSize / 2,
      radius,
    };
  });
}

export function x01GridRows(): number {
  return Math.ceil(ORDERED_CELLS.length / COLUMNS);
}

/** Which cell (if any) contains `point`, for a grid laid out within `width`. */
export function x01HitTest(
  point: { readonly x: number; readonly y: number },
  width: number,
): X01Cell | null {
  for (const bounds of x01GridLayout(width)) {
    const dx = point.x - bounds.cx;
    const dy = point.y - bounds.cy;
    if (dx * dx + dy * dy <= bounds.radius * bounds.radius) {
      return bounds.cell;
    }
  }
  return null;
}

/**
 * The numeric id the gesture reducer escalates — numbers use their wedge (1-20), BULL is the
 * sentinel 0 (no wedge is ever 0). BUST never reaches the reducer at all: it's single-action, no
 * upgrade path, fired directly on release (see useDartGesture.ts).
 */
export function x01CellId(cell: X01Cell): number {
  return cell.kind === "number" ? cell.wedge : 0;
}
