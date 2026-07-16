import { describe, expect, it } from "vitest";
import { x01CellId, x01GridLayout, x01GridRows, x01HitTest } from "./hitTest";

describe("x01GridLayout", () => {
  it("lays out 22 cells: BUST, 1..20, BULL", () => {
    const layout = x01GridLayout(400);
    expect(layout).toHaveLength(22);
    expect(layout[0]?.cell).toEqual({ kind: "bust" });
    expect(layout[1]?.cell).toEqual({ kind: "number", wedge: 1 });
    expect(layout[20]?.cell).toEqual({ kind: "number", wedge: 20 });
    expect(layout[21]?.cell).toEqual({ kind: "bull" });
  });

  it("flows 4 per row, in 6 rows (the last row holding just 20 and BULL)", () => {
    expect(x01GridRows()).toBe(6);
    const layout = x01GridLayout(400);
    const cellSize = 400 / 4;
    // 20 is index 20 -> row 5, col 0. BULL is index 21 -> row 5, col 1.
    expect(layout[20]?.cy).toBeCloseTo(5 * cellSize + cellSize / 2);
    expect(layout[20]?.cx).toBeCloseTo(cellSize / 2);
    expect(layout[21]?.cx).toBeCloseTo(cellSize + cellSize / 2);
  });
});

describe("x01HitTest", () => {
  it("finds BUST at the top-left cell's centre", () => {
    const layout = x01GridLayout(400);
    const bust = layout[0];
    if (!bust) throw new Error("expected a bust cell");
    expect(x01HitTest({ x: bust.cx, y: bust.cy }, 400)).toEqual({ kind: "bust" });
  });

  it("finds the numbered cell whose circle contains the point", () => {
    const layout = x01GridLayout(400);
    const seven = layout.find((b) => b.cell.kind === "number" && b.cell.wedge === 7);
    if (!seven) throw new Error("expected a cell for 7");
    expect(x01HitTest({ x: seven.cx, y: seven.cy }, 400)).toEqual({ kind: "number", wedge: 7 });
  });

  it("finds BULL at the last cell", () => {
    const layout = x01GridLayout(400);
    const bull = layout[21];
    if (!bull) throw new Error("expected a bull cell");
    expect(x01HitTest({ x: bull.cx, y: bull.cy }, 400)).toEqual({ kind: "bull" });
  });

  it("returns null for a point in the gap between circles", () => {
    // The far corner of cell 0's square, well outside its inscribed circle.
    const cellSize = 400 / 4;
    expect(x01HitTest({ x: cellSize - 1, y: cellSize - 1 }, 400)).toBeNull();
  });

  it("returns null well outside the grid", () => {
    expect(x01HitTest({ x: -1000, y: -1000 }, 400)).toBeNull();
  });
});

describe("x01CellId", () => {
  it("uses the wedge for numbered cells", () => {
    expect(x01CellId({ kind: "number", wedge: 14 })).toBe(14);
  });

  it("uses the sentinel 0 for BULL", () => {
    expect(x01CellId({ kind: "bull" })).toBe(0);
  });
});
