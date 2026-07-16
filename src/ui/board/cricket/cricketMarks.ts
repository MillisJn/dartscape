/**
 * Cricket tally-mark geometry — a direct port of ScoreButton.drawCricketMarker()'s
 * math from Dartscape OG Android. Pure geometry only (no Skia/Canvas), so the drawing
 * component just spreads whichever segments come back into its own Path/Line/Circle
 * nodes. Cumulative by design, matching the original: 0 marks = a dash, 1 = one
 * diagonal, 2 = both diagonals (an X), 3 = the X with a circle around it (closed).
 */

export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface Circle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface CricketMarkerGeometry {
  readonly dash?: Segment;
  readonly diagonal1?: Segment;
  readonly diagonal2?: Segment;
  readonly circle?: Circle;
}

/** `radius` is the marker's half-size (typically derived from the cell's smaller
 * dimension); `padding` insets the dash so it doesn't touch the cell edges. */
export function cricketMarkerPaths(
  cx: number,
  cy: number,
  radius: number,
  marks: number,
  padding = 0,
): CricketMarkerGeometry {
  if (marks <= 0) {
    return { dash: { x1: cx - radius + padding, y1: cy, x2: cx + radius - padding, y2: cy } };
  }

  // Inset the diagonals' endpoints from the cell corners — matches the original's
  // invRadius = radius / PI.
  const inv = radius / Math.PI;
  const diagonal1: Segment = {
    x1: cx - radius + inv,
    y1: cy - radius + inv,
    x2: cx + radius - inv,
    y2: cy + radius - inv,
  };

  if (marks === 1) return { diagonal1 };

  const diagonal2: Segment = {
    x1: cx + radius - inv,
    y1: cy - radius + inv,
    x2: cx - radius + inv,
    y2: cy + radius - inv,
  };

  if (marks === 2) return { diagonal1, diagonal2 };

  return { diagonal1, diagonal2, circle: { cx, cy, r: radius } };
}
