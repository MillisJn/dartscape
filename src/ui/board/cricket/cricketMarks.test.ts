import { describe, expect, it } from "vitest";
import { cricketMarkerPaths } from "./cricketMarks";

describe("cricketMarkerPaths", () => {
  it("draws only a dash at 0 marks", () => {
    const geo = cricketMarkerPaths(10, 10, 8, 0);
    expect(geo.dash).toEqual({ x1: 2, y1: 10, x2: 18, y2: 10 });
    expect(geo.diagonal1).toBeUndefined();
    expect(geo.diagonal2).toBeUndefined();
    expect(geo.circle).toBeUndefined();
  });

  it("draws only one diagonal at 1 mark", () => {
    const geo = cricketMarkerPaths(0, 0, 8, 1);
    expect(geo.dash).toBeUndefined();
    expect(geo.diagonal1).toBeDefined();
    expect(geo.diagonal2).toBeUndefined();
    expect(geo.circle).toBeUndefined();
  });

  it("draws both diagonals (an X) at 2 marks", () => {
    const geo = cricketMarkerPaths(0, 0, 8, 2);
    expect(geo.diagonal1).toBeDefined();
    expect(geo.diagonal2).toBeDefined();
    expect(geo.circle).toBeUndefined();
  });

  it("draws the X with a circle around it at 3 marks (closed)", () => {
    const geo = cricketMarkerPaths(5, 5, 8, 3);
    expect(geo.diagonal1).toBeDefined();
    expect(geo.diagonal2).toBeDefined();
    expect(geo.circle).toEqual({ cx: 5, cy: 5, r: 8 });
  });

  it("treats anything above 3 the same as closed", () => {
    const geo = cricketMarkerPaths(0, 0, 8, 99);
    expect(geo.circle).toBeDefined();
  });

  it("insets the diagonals from the cell corners by radius/PI", () => {
    const geo = cricketMarkerPaths(0, 0, Math.PI, 1);
    // inv = radius/PI = 1 when radius = PI
    expect(geo.diagonal1).toEqual({
      x1: -Math.PI + 1,
      y1: -Math.PI + 1,
      x2: Math.PI - 1,
      y2: Math.PI - 1,
    });
  });
});
