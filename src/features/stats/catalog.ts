import type { GameKind } from "@/core/game/config";
import type { Stats } from "@/core/stats/stats";

/**
 * Which stats belong to which game, and how to format them — a projection over core/stats.ts's
 * Stats interface. GRAND_PLAN.md assumed Phase 1 shipped this as core/stats/catalog.ts; it didn't
 * (core/stats/ is just stats.ts + its test), so this is Phase 2's own catalog instead — a display
 * concern, not a domain one, so it belongs here rather than in core/ (which Phase 2 must not
 * touch) regardless. Logged in PLAN.md's decisions log.
 */
export interface StatRow {
  readonly key: keyof Stats;
  readonly label: string;
  readonly format?: (value: number) => string;
}

const pct = (v: number) => `${v.toFixed(1)}%`;
const avg = (v: number) => v.toFixed(2);

const PER_GAME: Record<GameKind, readonly StatRow[]> = {
  x01: [
    { key: "threeDartAverage", label: "3-DART AVG", format: avg },
    { key: "firstNineAverage", label: "FIRST 9", format: avg },
    { key: "checkoutPercent", label: "CHECKOUT %", format: pct },
    { key: "bestLeg", label: "BEST LEG" },
    { key: "maximums", label: "180s" },
    { key: "highCheckout", label: "HIGH OUT" },
  ],
  cricket: [
    { key: "mpr", label: "MPR", format: avg },
    { key: "marks", label: "MARKS" },
  ],
  shanghai: [
    { key: "shanghais", label: "SHANGHAIS" },
    { key: "highScore", label: "HIGH SCORE" },
  ],
  baseball: [
    { key: "runs", label: "RUNS" },
    { key: "runsPerInning", label: "RUNS/INNING", format: avg },
    { key: "bestInning", label: "BEST INNING" },
    { key: "homeRuns", label: "HOME RUNS" },
    { key: "grandSlams", label: "GRAND SLAMS" },
  ],
  killer: [{ key: "kills", label: "KILLS" }],
  aroundTheClock: [{ key: "hitPercent", label: "HIT %", format: pct }],
  halveIt: [{ key: "highScore", label: "HIGH SCORE" }],
  bobs27: [{ key: "highScore", label: "HIGH SCORE" }],
};

/** Universal rows shown for every game, ahead of its specific ones. */
export const UNIVERSAL_ROWS: readonly StatRow[] = [
  { key: "games", label: "GAMES" },
  { key: "wins", label: "WINS" },
  { key: "winPercent", label: "WIN %", format: avg },
];

export function catalogFor(kind: GameKind): readonly StatRow[] {
  return PER_GAME[kind];
}
