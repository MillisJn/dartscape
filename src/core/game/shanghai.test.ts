import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, MISS } from "../board";
import type { ConfigOf, Player } from "./config";
import { runLog } from "./engine";
import type { GameEvent } from "./events";
import { shanghaiEngine, targetFor, totalRounds } from "./shanghai";

const TWO: readonly Player[] = [
  { id: "a", name: "Ava" },
  { id: "b", name: "Ben" },
];
const SOLO: readonly Player[] = [{ id: "a", name: "Ava" }];

const cfg = (from = 1, to = 7): ConfigOf<"shanghai"> => ({
  kind: "shanghai",
  from: from as ConfigOf<"shanghai">["from"],
  to: to as ConfigOf<"shanghai">["to"],
});

const play = (config: ConfigOf<"shanghai">, log: readonly Dart[], players = TWO) =>
  runLog(shanghaiEngine, config, players, log);

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);
const types = (e: readonly GameEvent[]) => e.map((x) => x.type);

describe("shanghai - the round walk", () => {
  it("counts rounds from the range", () => {
    expect(totalRounds(cfg(1, 7))).toBe(7);
    expect(totalRounds(cfg(1, 20))).toBe(20);
    expect(totalRounds(cfg(20, 1))).toBe(20);
    expect(totalRounds(cfg(5, 5))).toBe(1);
  });

  it("walks upward", () => {
    expect(targetFor(cfg(1, 7), 0)).toBe(1);
    expect(targetFor(cfg(1, 7), 3)).toBe(4);
    expect(targetFor(cfg(1, 7), 6)).toBe(7);
  });

  it("walks downward when from is above to", () => {
    expect(targetFor(cfg(20, 15), 0)).toBe(20);
    expect(targetFor(cfg(20, 15), 3)).toBe(17);
  });

  it("derives the target from the round, so it cannot drift", () => {
    const { state } = play(cfg(), [MISS, MISS, MISS, MISS, MISS, MISS]);
    expect(state.round).toBe(1);
    expect(targetFor(state.config, state.round)).toBe(2);
  });
});

describe("shanghai - scoring", () => {
  it("scores only the round number", () => {
    expect(play(cfg(), [T(1)]).state.scores[0]).toBe(3);
  });

  it("ignores everything else", () => {
    const { state, events } = play(cfg(), [T(20)]);
    expect(state.scores[0]).toBe(0);
    expect(types(events)).toContain("dartMissed");
  });

  it("moves to the next number after a round", () => {
    // Seat 0 and seat 1 both throw three at the 1, then it's the 2's turn.
    const log = [T(1), T(1), T(1), MISS, MISS, MISS, T(2)];
    const { state } = play(cfg(), log);
    expect(state.scores[0]).toBe(9 + 6);
  });

  it("counts trebles for the tie-break", () => {
    const { state } = play(cfg(), [T(1), S(1)]);
    expect(state.trebles[0]).toBe(1);
  });
});

describe("shanghai - the shanghai", () => {
  it("wins instantly on single, double and treble in one visit", () => {
    const { state, events } = play(cfg(), [S(1), D(1), T(1)]);
    expect(state.winner).toBe(0);
    expect(types(events)).toContain("shanghai");
    expect(types(events)).toContain("won");
  });

  it("does not care about the order", () => {
    expect(play(cfg(), [T(1), S(1), D(1)]).state.winner).toBe(0);
  });

  it("does not fire across two visits", () => {
    // S, D in visit one; T in a later visit at the same number is impossible
    // (the round moves on), so use misses to burn the visit.
    const log = [S(1), D(1), MISS, MISS, MISS, MISS];
    expect(play(cfg(), log).state.winner).toBeNull();
  });

  it("does not fire on three of the same ring", () => {
    expect(play(cfg(), [T(1), T(1), T(1)]).state.winner).toBeNull();
  });
});

describe("shanghai - the end of the game", () => {
  it("gives it to the highest score after the last round", () => {
    // One round, one player: three darts and it's over.
    const { state } = play(cfg(1, 1), [T(1), S(1), S(1)], SOLO);
    expect(state.winner).toBe(0);
    expect(state.scores[0]).toBe(5);
  });

  it("gives it to the leader with two players", () => {
    const log = [S(1), MISS, MISS, T(1), MISS, MISS];
    const { state } = play(cfg(1, 1), log);
    expect(state.scores).toEqual([1, 3]);
    expect(state.winner).toBe(1);
  });

  it("breaks a tie on trebles", () => {
    // Both score 3: seat 0 with three singles, seat 1 with one treble.
    const log = [S(1), S(1), S(1), T(1), MISS, MISS];
    const { state } = play(cfg(1, 1), log);
    expect(state.scores).toEqual([3, 3]);
    expect(state.winner).toBe(1);
  });
});

describe("shanghai - undo is just a shorter log", () => {
  it("rewinds a shanghai", () => {
    const log = [S(1), D(1), T(1)];
    expect(play(cfg(), log).state.winner).toBe(0);
    expect(play(cfg(), log.slice(0, -1)).state.winner).toBeNull();
  });
});

describe("shanghai - aim", () => {
  it("goes for the treble of the round number", () => {
    const { state } = play(cfg(), []);
    expect(shanghaiEngine.aim(state)).toEqual(T(1));
  });

  it("chases the shanghai once a treble is banked", () => {
    const { state } = play(cfg(), [T(1)]);
    expect(shanghaiEngine.aim(state)).toEqual(D(1));
  });

  it("collects the single last", () => {
    const { state } = play(cfg(), [T(1), D(1)]);
    expect(shanghaiEngine.aim(state)).toEqual(S(1));
  });

  it("goes back to scoring once the shanghai is dead", () => {
    const { state } = play(cfg(), [MISS, T(1)]);
    expect(shanghaiEngine.aim(state)).toEqual(T(1));
  });
});

describe("shanghai - view", () => {
  it("shows the target and the round", () => {
    const { state } = play(cfg(1, 7), []);
    const view = shanghaiEngine.view(state);
    expect(view.panel).toMatchObject({
      kind: "shanghai",
      target: 1,
      round: 1,
      lastRound: 7,
    });
  });
});
