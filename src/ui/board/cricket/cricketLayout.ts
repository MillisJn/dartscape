import { CRICKET_TARGETS, type CricketTarget } from "@/core/game/cricket";

/**
 * Layout + hit-test for the merged cricket sheet — a mirrored grid with a central
 * number-label column (20..15, BULL, MISS) flanked by one tappable column per seat,
 * half on each side. Structurally different from targetGrid.ts's flat circular-cell
 * list (this is keyed by seat x row, and hit-testing is scoped to a single active
 * seat's column), so it gets its own module rather than being forced into that one.
 *
 * Row order: CRICKET_TARGETS (20,19,18,17,16,15,bull), then a MISS row — the miss
 * row isn't in the original Android layout, but the current per-dart logging model
 * needs an explicit miss affordance mid-visit (every other panel's TargetBoard has
 * an equivalent MISS action cell).
 */

export const MISS_ROW_INDEX = CRICKET_TARGETS.length;
export const TOTAL_ROWS = CRICKET_TARGETS.length + 1;

/** The player-column width relative to the label column — mirrors frag_game.xml's
 * layout_weight="1" (player columns) vs layout_weight=".7" (label column). */
const LABEL_WEIGHT = 0.7;
/** Row height relative to a seat column's width — a wide, short rectangle, matching
 * the original's flattened cricket rows (derived purely from width, like
 * targetGrid.ts's RADIUS_FACTOR, since layout only receives a width to work with). */
const ROW_ASPECT = 0.62;

export interface CricketGridLayout {
  readonly labelColumnWidth: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly leftSeats: readonly number[];
  readonly rightSeats: readonly number[];
  readonly width: number;
  readonly height: number;
}

/** Splits seats into two halves around the label column — matches the original
 * exactly for 2 players (one column each side); a generalization for 3-4. */
export function cricketGridLayout(seatCount: number, width: number): CricketGridLayout {
  const seats = Array.from({ length: seatCount }, (_, i) => i);
  const half = Math.ceil(seatCount / 2);
  const leftSeats = seats.slice(0, half);
  const rightSeats = seats.slice(half);

  const totalUnits = leftSeats.length + rightSeats.length + LABEL_WEIGHT;
  const cellWidth = width / totalUnits;
  const labelColumnWidth = cellWidth * LABEL_WEIGHT;
  const cellHeight = cellWidth * ROW_ASPECT;

  return {
    labelColumnWidth,
    cellWidth,
    cellHeight,
    leftSeats,
    rightSeats,
    width,
    height: cellHeight * TOTAL_ROWS,
  };
}

/** The left edge x of a seat's column, or null if that seat isn't laid out. */
export function cricketColumnX(layout: CricketGridLayout, seat: number): number | null {
  const leftIndex = layout.leftSeats.indexOf(seat);
  if (leftIndex !== -1) return leftIndex * layout.cellWidth;

  const rightIndex = layout.rightSeats.indexOf(seat);
  if (rightIndex === -1) return null;

  const leftWidth = layout.leftSeats.length * layout.cellWidth;
  return leftWidth + layout.labelColumnWidth + rightIndex * layout.cellWidth;
}

export interface CricketCellRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The rect for one seat's cell at `rowIndex` (0-6 = CRICKET_TARGETS, 7 = MISS). */
export function cricketCellRect(
  layout: CricketGridLayout,
  seat: number,
  rowIndex: number,
): CricketCellRect | null {
  const x = cricketColumnX(layout, seat);
  if (x === null || rowIndex < 0 || rowIndex >= TOTAL_ROWS) return null;
  return { x, y: rowIndex * layout.cellHeight, width: layout.cellWidth, height: layout.cellHeight };
}

/** The mark-array / row index for a cricket target — 0-6, matching CRICKET_TARGETS. */
export function cricketCellId(target: CricketTarget): number {
  return CRICKET_TARGETS.indexOf(target);
}

export type CricketHit =
  | { readonly kind: "target"; readonly targetIndex: number }
  | { readonly kind: "miss" };

/** Hit-tests a point against ONE seat's column only — the geometry-level enforcement
 * that other seats' columns are structurally untappable, not just visually dimmed. */
export function cricketGridHitTest(
  layout: CricketGridLayout,
  seat: number,
  point: { readonly x: number; readonly y: number },
): CricketHit | null {
  const x = cricketColumnX(layout, seat);
  if (x === null) return null;
  if (point.x < x || point.x >= x + layout.cellWidth) return null;
  if (point.y < 0 || point.y >= layout.height) return null;

  const rowIndex = Math.floor(point.y / layout.cellHeight);
  if (rowIndex === MISS_ROW_INDEX) return { kind: "miss" };
  return { kind: "target", targetIndex: rowIndex };
}
