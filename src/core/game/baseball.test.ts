import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, INNER_BULL, MISS, OUTER_BULL } from "../board";
import { advance, baseballEngine, basesLoaded, basesOf, inningOf } from "./baseball";
import type { ConfigOf, Player } from "./config";
import { runLog } from "./engine";
import type { GameEvent } from "./events";

const TWO: readonly Player[] = [
  { id: "a", name: "Ava" },
  { id: "b", name: "Ben" },
];
const cfg = (innings = 9): ConfigOf<"baseball"> => ({ kind: "baseball", innings });

const play = (config: ConfigOf<"baseball">, log: readonly Dart[], players = TWO) =>
  runLog(baseballEngine, config, players, log);

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);
const types = (e: readonly GameEvent[]) => e.map((x) => x.type);
const OUT: Dart = MISS;

describe("basesOf", () => {
  it("reads the multiplier as bases", () => {
    expect(basesOf(S(1), 1)).toBe(1);
    expect(basesOf(D(1), 1)).toBe(2);
    expect(basesOf(T(1), 1)).toBe(3);
  });

  it("makes any bull a home run", () => {
    expect(basesOf(INNER_BULL, 1)).toBe(4);
    expect(basesOf(OUTER_BULL, 5)).toBe(4);
  });

  it("is an out off the inning number", () => {
    expect(basesOf(T(7), 1)).toBe(0);
    expect(basesOf(MISS, 1)).toBe(0);
  });
});

describe("advance", () => {
  const EMPTY = [false, false, false, false];

  it("puts the batter on first for a single", () => {
    expect(advance(EMPTY, 1)).toEqual({ bases: [false, true, false, false], runs: 0 });
  });

  it("scores the batter on a home run", () => {
    expect(advance(EMPTY, 4)).toEqual({ bases: EMPTY, runs: 1 });
  });

  it("moves everyone along", () => {
    const onFirst = [false, true, false, false];
    expect(advance(onFirst, 2)).toEqual({ bases: [false, false, true, true], runs: 0 });
  });

  it("brings a runner home from third", () => {
    const onThird = [false, false, false, true];
    expect(advance(onThird, 1)).toEqual({ bases: [false, true, false, false], runs: 1 });
  });

  it("clears the bases on a grand slam", () => {
    const loaded = [false, true, true, true];
    expect(advance(loaded, 4)).toEqual({ bases: EMPTY, runs: 4 });
  });

  it("never leaves the batter standing on home", () => {
    expect(advance(EMPTY, 3).bases[0]).toBe(false);
  });
});

describe("basesLoaded", () => {
  it("needs all three occupied", () => {
    expect(basesLoaded([false, true, true, true])).toBe(true);
    expect(basesLoaded([true, true, true, false])).toBe(false);
  });
});

describe("baseball - innings", () => {
  it("starts at inning one", () => {
    expect(inningOf(play(cfg(), []).state)).toBe(1);
  });

  it("throws at the inning number", () => {
    expect(play(cfg(), [S(1)]).state.scores[0]).toBe(0);
    expect(play(cfg(), [S(1)]).state.bases).toEqual([false, true, false, false]);
  });

  it("advances the inning after everyone bats", () => {
    const outs: Dart[] = [OUT, OUT, OUT, OUT, OUT, OUT];
    const { state } = play(cfg(), outs);
    expect(inningOf(state)).toBe(2);
  });
});

describe("baseball - outs", () => {
  it("counts an out", () => {
    const { state, events } = play(cfg(), [OUT]);
    expect(state.outs).toBe(1);
    expect(types(events)).toContain("out");
  });

  it("ends the at-bat on three, not on three darts", () => {
    const { state, events } = play(cfg(), [OUT, OUT, OUT]);
    expect(state.visit.seat).toBe(1);
    expect(state.outs).toBe(0);
    expect(types(events)).toContain("inningEnded");
  });

  it("lets a good batter throw more than three darts", () => {
    const { state } = play(cfg(), [S(1), S(1), S(1), S(1), S(1)]);
    expect(state.visit.seat).toBe(0);
    expect(state.visit.darts).toHaveLength(5);
  });

  it("clears the bases at the end of an at-bat", () => {
    const { state } = play(cfg(), [S(1), OUT, OUT, OUT]);
    expect(state.bases).toEqual([false, false, false, false]);
  });
});

describe("baseball - runs", () => {
  it("scores a run on a home run", () => {
    const { state, events } = play(cfg(), [INNER_BULL]);
    expect(state.scores[0]).toBe(1);
    expect(types(events)).toContain("homeRun");
  });

  it("scores four on a grand slam", () => {
    // Three singles load the bases, then the bull clears them.
    const { state, events } = play(cfg(), [S(1), S(1), S(1), INNER_BULL]);
    expect(state.bases).toEqual([false, false, false, false]);
    expect(state.scores[0]).toBe(4);
    expect(types(events)).toContain("grandSlam");
  });

  it("does not call a grand slam without the bases loaded", () => {
    const { events } = play(cfg(), [INNER_BULL]);
    expect(types(events)).not.toContain("grandSlam");
  });

  it("drives in a run with a triple behind runners", () => {
    const { state } = play(cfg(), [S(1), T(1)]);
    expect(state.scores[0]).toBe(1);
  });
});

describe("baseball - winning", () => {
  it("ends after the last inning and gives it to the most runs", () => {
    const log: Dart[] = [
      INNER_BULL,
      OUT,
      OUT,
      OUT, // seat 0: 1 run
      OUT,
      OUT,
      OUT, // seat 1: nothing
    ];
    const { state, events } = play(cfg(1), log);
    expect(state.winner).toBe(0);
    expect(types(events)).toContain("won");
  });

  it("does not end early", () => {
    const log: Dart[] = [OUT, OUT, OUT, OUT, OUT, OUT];
    expect(play(cfg(9), log).state.winner).toBeNull();
  });
});

describe("baseball - undo is just a shorter log", () => {
  it("rewinds the bases", () => {
    const log = [S(1), S(1)];
    expect(play(cfg(), log).state.bases).toEqual([false, true, true, false]);
    expect(play(cfg(), log.slice(0, 1)).state.bases).toEqual([false, true, false, false]);
  });

  it("rewinds runs", () => {
    const log = [S(1), S(1), S(1), INNER_BULL];
    expect(play(cfg(), log).state.scores[0]).toBe(4);
    expect(play(cfg(), log.slice(0, -1)).state.scores[0]).toBe(0);
  });
});

describe("baseball - aim", () => {
  it("goes for the treble of the inning", () => {
    expect(baseballEngine.aim(play(cfg(), []).state)).toEqual(T(1));
  });

  it("goes for the bull with the bases loaded", () => {
    const { state } = play(cfg(), [S(1), S(1), S(1)]);
    expect(basesLoaded(state.bases)).toBe(true);
    expect(baseballEngine.aim(state)).toEqual({ ring: "innerBull" });
  });
});

describe("baseball - view", () => {
  it("feeds the diamond", () => {
    const { state } = play(cfg(9), [S(1), OUT]);
    const view = baseballEngine.view(state);
    expect(view.panel).toMatchObject({
      kind: "baseball",
      inning: 1,
      innings: 9,
      outs: 1,
      bases: [false, true, false, false],
      baseHits: 1,
    });
  });
});
