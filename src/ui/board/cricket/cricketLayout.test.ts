import { describe, expect, it } from "vitest";
import {
  cricketCellId,
  cricketCellRect,
  cricketColumnX,
  cricketGridHitTest,
  cricketGridLayout,
  TOTAL_ROWS,
} from "./cricketLayout";

describe("cricketGridLayout", () => {
  it("splits 2 seats one to each side of the label column", () => {
    const layout = cricketGridLayout(2, 500);
    expect(layout.leftSeats).toEqual([0]);
    expect(layout.rightSeats).toEqual([1]);
    // total width = leftSeat + label + rightSeat
    expect(
      layout.leftSeats.length * layout.cellWidth +
        layout.labelColumnWidth +
        layout.rightSeats.length * layout.cellWidth,
    ).toBeCloseTo(500);
  });

  it("splits an odd seat count with the extra seat on the left", () => {
    const layout = cricketGridLayout(3, 500);
    expect(layout.leftSeats).toEqual([0, 1]);
    expect(layout.rightSeats).toEqual([2]);
  });

  it("has 7 rows tall (one per cricket target)", () => {
    const layout = cricketGridLayout(2, 500);
    expect(layout.height).toBeCloseTo(layout.cellHeight * TOTAL_ROWS);
    expect(TOTAL_ROWS).toBe(7);
  });
});

describe("cricketColumnX", () => {
  it("places seat 0 at the left edge", () => {
    const layout = cricketGridLayout(2, 500);
    expect(cricketColumnX(layout, 0)).toBeCloseTo(0);
  });

  it("places seat 1 after the label column", () => {
    const layout = cricketGridLayout(2, 500);
    const expected = layout.leftSeats.length * layout.cellWidth + layout.labelColumnWidth;
    expect(cricketColumnX(layout, 1)).toBeCloseTo(expected);
  });

  it("returns null for a seat outside the layout", () => {
    const layout = cricketGridLayout(2, 500);
    expect(cricketColumnX(layout, 5)).toBeNull();
  });
});

describe("cricketCellRect", () => {
  it("returns a rect sized to one cell", () => {
    const layout = cricketGridLayout(2, 500);
    const rect = cricketCellRect(layout, 0, 0);
    expect(rect).toEqual({ x: 0, y: 0, width: layout.cellWidth, height: layout.cellHeight });
  });

  it("returns null for an out-of-range row", () => {
    const layout = cricketGridLayout(2, 500);
    expect(cricketCellRect(layout, 0, TOTAL_ROWS)).toBeNull();
  });
});

describe("cricketCellId", () => {
  it("maps 20 to index 0 and bull to the last index", () => {
    expect(cricketCellId(20)).toBe(0);
    expect(cricketCellId("bull")).toBe(6);
  });
});

describe("cricketGridHitTest", () => {
  it("finds the correct row inside the active seat's own column", () => {
    const layout = cricketGridLayout(2, 500);
    const point = { x: layout.cellWidth / 2, y: layout.cellHeight * 2 + 1 };
    expect(cricketGridHitTest(layout, 0, point)).toEqual({ kind: "target", targetIndex: 2 });
  });

  it("ignores a point inside a DIFFERENT seat's column", () => {
    const layout = cricketGridLayout(2, 500);
    const otherColumnX = cricketColumnX(layout, 1) ?? 0;
    const point = { x: otherColumnX + 1, y: 1 };
    // seat 0's own column doesn't extend into seat 1's column
    expect(cricketGridHitTest(layout, 0, point)).toBeNull();
  });

  it("returns null outside the grid entirely", () => {
    const layout = cricketGridLayout(2, 500);
    expect(cricketGridHitTest(layout, 0, { x: -10, y: -10 })).toBeNull();
  });
});
