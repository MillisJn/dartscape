import { describe, expect, it } from "vitest";
import { targetCellId, targetGridHitTest, targetGridLayout, targetGridRows } from "./targetGrid";

describe("targetGridLayout", () => {
  it("lays out cells in reading order, columns per row", () => {
    const cells = [
      { kind: "action", id: "miss", label: "MISS" },
      { kind: "number", wedge: 20 },
      { kind: "number", wedge: 19 },
      { kind: "bull" },
    ] as const;
    const layout = targetGridLayout(cells, 400, 2);
    expect(layout).toHaveLength(4);
    expect(targetGridRows(cells, 2)).toBe(2);
    const cellSize = 200;
    expect(layout[0]?.cx).toBeCloseTo(cellSize / 2);
    expect(layout[0]?.cy).toBeCloseTo(cellSize / 2);
    expect(layout[2]?.cx).toBeCloseTo(cellSize / 2);
    expect(layout[2]?.cy).toBeCloseTo(cellSize + cellSize / 2);
  });
});

describe("targetGridHitTest", () => {
  const cells = [
    { kind: "action", id: "miss", label: "MISS" },
    { kind: "number", wedge: 20 },
    { kind: "bull" },
  ] as const;

  it("finds a cell at its centre", () => {
    const layout = targetGridLayout(cells, 300, 3);
    const bull = layout[2];
    if (!bull) throw new Error("expected a bull cell");
    expect(targetGridHitTest(cells, { x: bull.cx, y: bull.cy }, 300, 3)).toEqual({ kind: "bull" });
  });

  it("returns null outside every cell", () => {
    expect(targetGridHitTest(cells, { x: -999, y: -999 }, 300, 3)).toBeNull();
  });
});

describe("targetCellId", () => {
  it("uses the wedge for a number cell", () => {
    expect(targetCellId({ kind: "number", wedge: 15 })).toBe(15);
  });
  it("uses 0 for bull", () => {
    expect(targetCellId({ kind: "bull" })).toBe(0);
  });
  it("uses -1 for an action cell", () => {
    expect(targetCellId({ kind: "action", id: "miss", label: "MISS" })).toBe(-1);
  });
});
