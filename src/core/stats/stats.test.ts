import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, INNER_BULL, MISS } from "../board";
import type { GameConfig, Player } from "../game/config";
import { type CompletedGame, computeStats } from "./stats";

const AVA: Player = { id: "ava", name: "Ava" };
const BEN: Player = { id: "ben", name: "Ben" };

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);

const X01: GameConfig = { kind: "x01", start: 501, in: "straight", out: "double" };
const CRICKET: GameConfig = { kind: "cricket", scoring: "points" };

let seq = 0;
const game = (
  config: GameConfig,
  log: readonly Dart[],
  players: readonly Player[] = [AVA],
  winner: number | null = null,
): CompletedGame => ({
  id: `g${seq++}`,
  config,
  players,
  log,
  winner,
  playedAt: Date.now(),
});

const statsOf = (games: readonly CompletedGame[]) => computeStats(games, "ava");

describe("stats - nothing to report", () => {
  it("is all zeroes with no games", () => {
    const s = statsOf([]);
    expect(s.games).toBe(0);
    expect(s.threeDartAverage).toBe(0);
    expect(s.checkoutPercent).toBe(0);
    expect(s.bestLeg).toBeNull();
  });

  it("ignores games the player was not in", () => {
    expect(statsOf([game(X01, [T(20)], [BEN])]).games).toBe(0);
  });
});

describe("stats - games and wins", () => {
  it("counts games, wins and win percent", () => {
    const s = statsOf([game(X01, [T(20)], [AVA], 0), game(X01, [T(20)], [AVA], null)]);
    expect(s.games).toBe(2);
    expect(s.wins).toBe(1);
    expect(s.winPercent).toBe(50);
  });
});

describe("stats - the board", () => {
  it("counts each ring", () => {
    const s = statsOf([game(X01, [T(20), D(20), S(20), INNER_BULL, MISS])]);
    expect(s.trebles).toBe(1);
    expect(s.doubles).toBe(1);
    expect(s.singles).toBe(1);
    expect(s.innerBulls).toBe(1);
    expect(s.darts).toBe(5);
  });

  it("measures hit percent", () => {
    const s = statsOf([game(X01, [T(20), MISS, MISS, MISS])]);
    expect(s.hits).toBe(1);
    expect(s.hitPercent).toBe(25);
  });

  it("finds the best and worst number", () => {
    const s = statsOf([game(X01, [T(20), S(20), S(20), S(5)])]);
    expect(s.bestNumber).toBe(20);
    expect(s.worstNumber).toBe(5);
  });
});

describe("stats - PPD and the 3-dart average", () => {
  it("divides points by darts", () => {
    // 60 + 60 + 60 = 180 over 3 darts = 60 PPD.
    const s = statsOf([game(X01, [T(20), T(20), T(20)])]);
    expect(s.ppd).toBe(60);
    expect(s.threeDartAverage).toBe(180);
  });

  it("counts a miss as a dart", () => {
    const s = statsOf([game(X01, [T(20), MISS, MISS])]);
    expect(s.ppd).toBe(20);
    expect(s.threeDartAverage).toBe(60);
  });

  it("counts darts thrown in a busted visit", () => {
    // 501 down to 40 is not reachable in a short log, so use the visit at the
    // start: three trebles score, nothing busts, average holds.
    const s = statsOf([game(X01, [T(20), T(20), T(20), S(1), S(1), S(1)])]);
    expect(s.darts).toBe(6);
    expect(s.ppd).toBeCloseTo((180 + 3) / 6, 5);
  });

  it("only counts my darts in a two-player game", () => {
    // Ava throws three trebles, Ben throws three misses.
    const log = [T(20), T(20), T(20), MISS, MISS, MISS];
    const s = computeStats([game(X01, log, [AVA, BEN])], "ava");
    expect(s.darts).toBe(3);
    expect(s.threeDartAverage).toBe(180);
  });
});

describe("stats - first nine", () => {
  it("measures scoring power over the opening three visits", () => {
    const log = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(20), S(1)];
    const s = statsOf([game(X01, log)]);
    expect(s.firstNineAverage).toBe(180);
    // The tenth dart drags the overall average down but not the first nine.
    expect(s.threeDartAverage).toBeLessThan(180);
  });

  it("copes with fewer than nine darts", () => {
    expect(statsOf([game(X01, [T(20)])]).firstNineAverage).toBe(180);
  });
});

describe("stats - ton bands", () => {
  it("counts a maximum", () => {
    expect(statsOf([game(X01, [T(20), T(20), T(20)])]).maximums).toBe(1);
  });

  it("counts a 140", () => {
    const s = statsOf([game(X01, [T(20), T(20), S(20)])]);
    expect(s.ton140s).toBe(1);
    expect(s.maximums).toBe(0);
  });

  it("counts a ton", () => {
    expect(statsOf([game(X01, [T(20), S(20), S(20)])]).ton100s).toBe(1);
  });

  it("counts a 60", () => {
    expect(statsOf([game(X01, [S(20), S(20), S(20)])]).score60s).toBe(1);
  });

  it("tracks the best visit", () => {
    const log = [S(20), S(20), S(20), T(20), T(20), T(20)];
    expect(statsOf([game(X01, log)]).bestVisit).toBe(180);
  });
});

/** An X01 config starting from any score — tests shouldn't throw 20 darts to reach a finish. */
const x01From = (start: number, out: "double" | "straight" = "double"): GameConfig => ({
  kind: "x01",
  start: start as 501,
  in: "straight",
  out,
});

describe("stats - checkout percentage", () => {
  it("counts a dart at a double and the conversion", () => {
    // 100: T20 leaves 40 (a double), then D20 finishes it.
    const s = statsOf([game(x01From(100), [T(20), D(20)], [AVA], 0)]);
    expect(s.checkoutAttempts).toBe(1);
    expect(s.checkoutsHit).toBe(1);
    expect(s.checkoutPercent).toBe(100);
  });

  it("counts a missed double as an attempt", () => {
    // Sitting on 40: three darts thrown at a double, none converted.
    const s = statsOf([game(x01From(40), [MISS, MISS, MISS], [AVA], null)]);
    expect(s.checkoutAttempts).toBe(3);
    expect(s.checkoutsHit).toBe(0);
    expect(s.checkoutPercent).toBe(0);
  });

  it("does not count darts thrown while out of range", () => {
    // 501 is not a finish, so nothing here was thrown at a double.
    expect(statsOf([game(X01, [T(20), T(20), T(20)])]).checkoutAttempts).toBe(0);
  });

  it("does not count an odd score as a dart at a double", () => {
    expect(statsOf([game(x01From(39), [MISS], [AVA], null)]).checkoutAttempts).toBe(0);
  });

  it("counts the bull as a finish from 50", () => {
    const s = statsOf([game(x01From(50), [INNER_BULL], [AVA], 0)]);
    expect(s.checkoutAttempts).toBe(1);
    expect(s.checkoutsHit).toBe(1);
  });

  it("gives a half-decent percentage over several attempts", () => {
    const s = statsOf([
      game(x01From(40), [D(20)], [AVA], 0), // hit
      game(x01From(40), [MISS], [AVA], null), // missed
      game(x01From(40), [MISS], [AVA], null), // missed
      game(x01From(40), [D(20)], [AVA], 0), // hit
    ]);
    expect(s.checkoutAttempts).toBe(4);
    expect(s.checkoutsHit).toBe(2);
    expect(s.checkoutPercent).toBe(50);
  });
});

describe("stats - legs and checkouts", () => {
  const won100 = () => game(x01From(100), [T(20), D(20)], [AVA], 0);

  it("records the high checkout", () => {
    expect(statsOf([won100()]).highCheckout).toBe(40);
  });

  it("records the best leg in darts", () => {
    expect(statsOf([won100()]).bestLeg).toBe(2);
  });

  it("takes the fewest darts across several legs", () => {
    const long = game(x01From(100), [S(20), S(20), S(20), S(20), D(10)], [AVA], 0);
    expect(statsOf([long, won100()]).bestLeg).toBe(2);
  });

  it("ignores legs that were lost", () => {
    expect(statsOf([game(X01, [T(20)], [AVA], null)]).bestLeg).toBeNull();
  });
});

describe("stats - cricket MPR", () => {
  it("is marks over darts times three", () => {
    // T20 T20 T20 = 9 marks over 3 darts = 9.0 MPR (a perfect round).
    expect(statsOf([game(CRICKET, [T(20), T(20), T(20)])]).mpr).toBe(9);
  });

  it("counts the bull correctly", () => {
    // Inner bull is 2 marks, so 2 marks over 1 dart = 6.0 MPR.
    expect(statsOf([game(CRICKET, [INNER_BULL])]).mpr).toBe(6);
  });

  it("is a realistic 3.0 for one mark a dart", () => {
    expect(statsOf([game(CRICKET, [S(20), S(19), S(18)])]).mpr).toBe(3);
  });

  it("counts marks off-sheet as nothing", () => {
    // The 7 is not a cricket number, so no marks - but it is still a dart.
    const s = statsOf([game(CRICKET, [T(20), T(7), T(7)])]);
    expect(s.marks).toBe(3);
    expect(s.mpr).toBe(3);
  });
});

describe("stats - the league rating", () => {
  it("is (MPR x 10) + PPD", () => {
    const s = statsOf([
      game(CRICKET, [S(20), S(19), S(18)]), // 3.0 MPR
      game(X01, [T(20), T(20), T(20)]), // 60 PPD
    ]);
    expect(s.mpr).toBe(3);
    expect(s.ppd).toBe(60);
    expect(s.rating).toBe(90);
  });
});

describe("stats - across games", () => {
  it("adds up", () => {
    const s = statsOf([game(X01, [T(20), T(20), T(20)]), game(X01, [S(20), S(20), S(20)])]);
    expect(s.games).toBe(2);
    expect(s.darts).toBe(6);
    expect(s.maximums).toBe(1);
    expect(s.score60s).toBe(1);
    expect(s.ppd).toBe(40); // (180 + 60) / 6
  });
});
