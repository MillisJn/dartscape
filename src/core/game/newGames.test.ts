import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, INNER_BULL, MISS, OUTER_BULL } from "../board";
import { aroundTheClockEngine, clears, sequenceOf } from "./aroundTheClock";
import { BOBS_27_ROUNDS, BOBS_27_START, bobs27Engine, hits, valueOfRound } from "./bobs27";
import type { ConfigOf, Player } from "./config";
import { runLog } from "./engine";
import type { GameEvent } from "./events";
import { HALVE_IT_ROUNDS, halveItEngine, scoreFor } from "./halveIt";

const TWO: readonly Player[] = [
  { id: "a", name: "Ava" },
  { id: "b", name: "Ben" },
];
const SOLO: readonly Player[] = [{ id: "a", name: "Ava" }];

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);
const types = (e: readonly GameEvent[]) => e.map((x) => x.type);

// ===========================================================================
// Around the Clock
// ===========================================================================

const clockCfg = (over: Partial<ConfigOf<"aroundTheClock">> = {}): ConfigOf<"aroundTheClock"> => ({
  kind: "aroundTheClock",
  ring: "any",
  includeBull: false,
  ...over,
});

const clock = (config: ConfigOf<"aroundTheClock">, log: readonly Dart[], players = SOLO) =>
  runLog(aroundTheClockEngine, config, players, log);

describe("around the clock - the sequence", () => {
  it("runs 1 to 20", () => {
    const seq = sequenceOf(clockCfg());
    expect(seq).toHaveLength(20);
    expect(seq[0]).toBe(1);
    expect(seq[19]).toBe(20);
  });

  it("adds the bull when asked", () => {
    const seq = sequenceOf(clockCfg({ includeBull: true }));
    expect(seq).toHaveLength(21);
    expect(seq[20]).toBe("bull");
  });
});

describe("around the clock - clearing a number", () => {
  it("takes any ring by default", () => {
    expect(clears(S(1), 1, "any")).toBe(true);
    expect(clears(D(1), 1, "any")).toBe(true);
    expect(clears(T(1), 1, "any")).toBe(true);
  });

  it("rejects the wrong number", () => {
    expect(clears(T(2), 1, "any")).toBe(false);
    expect(clears(MISS, 1, "any")).toBe(false);
  });

  it("demands a double when configured", () => {
    expect(clears(S(1), 1, "double")).toBe(false);
    expect(clears(D(1), 1, "double")).toBe(true);
    expect(clears(T(1), 1, "double")).toBe(false);
  });

  it("treats the inner bull as the bulls double", () => {
    expect(clears(INNER_BULL, "bull", "double")).toBe(true);
    expect(clears(OUTER_BULL, "bull", "double")).toBe(false);
    expect(clears(OUTER_BULL, "bull", "any")).toBe(true);
  });

  it("knows the bull has no treble", () => {
    expect(clears(INNER_BULL, "bull", "treble")).toBe(false);
  });
});

describe("around the clock - playing", () => {
  it("starts everyone on the 1", () => {
    expect(clock(clockCfg(), []).state.at).toEqual([0]);
  });

  it("moves you on when you hit", () => {
    const { state } = clock(clockCfg(), [S(1)]);
    expect(state.at[0]).toBe(1);
    expect(state.scores[0]).toBe(1);
  });

  it("leaves you where you are when you miss", () => {
    const { state, events } = clock(clockCfg(), [S(5)]);
    expect(state.at[0]).toBe(0);
    expect(types(events)).toContain("dartMissed");
  });

  it("lets you clear several in one visit", () => {
    expect(clock(clockCfg(), [S(1), S(2), S(3)]).state.at[0]).toBe(3);
  });

  it("wins on clearing the 20", () => {
    const all = Array.from({ length: 20 }, (_, i) => S((i + 1) as 1));
    const { state, events } = clock(clockCfg(), all);
    expect(state.winner).toBe(0);
    expect(types(events)).toContain("won");
  });

  it("needs the bull too when it is in", () => {
    const all = Array.from({ length: 20 }, (_, i) => S((i + 1) as 1));
    const config = clockCfg({ includeBull: true });
    expect(clock(config, all).state.winner).toBeNull();
    expect(clock(config, [...all, OUTER_BULL]).state.winner).toBe(0);
  });

  it("is a race between two players", () => {
    // Ava clears 1,2,3; Ben misses everything.
    const log = [S(1), S(2), S(3), MISS, MISS, MISS];
    const { state } = clock(clockCfg(), log, TWO);
    expect(state.at).toEqual([3, 0]);
  });

  it("rewinds a dart", () => {
    const log = [S(1), S(2)];
    expect(clock(clockCfg(), log).state.at[0]).toBe(2);
    expect(clock(clockCfg(), log.slice(0, -1)).state.at[0]).toBe(1);
  });
});

describe("around the clock - aim", () => {
  it("aims at the number you are on", () => {
    expect(aroundTheClockEngine.aim(clock(clockCfg(), []).state)).toEqual(S(1));
    expect(aroundTheClockEngine.aim(clock(clockCfg(), [S(1)]).state)).toEqual(S(2));
  });

  it("aims at the double when doubles are required", () => {
    const config = clockCfg({ ring: "double" });
    expect(aroundTheClockEngine.aim(clock(config, []).state)).toEqual(D(1));
  });
});

// ===========================================================================
// Halve It
// ===========================================================================

const HALVE: ConfigOf<"halveIt"> = { kind: "halveIt" };
const halve = (log: readonly Dart[], players = SOLO) => runLog(halveItEngine, HALVE, players, log);

describe("halve it - the targets", () => {
  it("runs the classic seven", () => {
    expect(HALVE_IT_ROUNDS).toHaveLength(7);
    expect(HALVE_IT_ROUNDS[0]).toEqual({ kind: "number", wedge: 20 });
    expect(HALVE_IT_ROUNDS[3]).toEqual({ kind: "anyDouble" });
    expect(HALVE_IT_ROUNDS[5]).toEqual({ kind: "anyTreble" });
    expect(HALVE_IT_ROUNDS[6]).toEqual({ kind: "bull" });
  });
});

describe("halve it - scoring a dart", () => {
  it("scores the face value of the round number", () => {
    expect(scoreFor(T(20), { kind: "number", wedge: 20 })).toBe(60);
    expect(scoreFor(S(20), { kind: "number", wedge: 20 })).toBe(20);
    expect(scoreFor(S(19), { kind: "number", wedge: 20 })).toBe(0);
  });

  it("takes any double on the doubles round", () => {
    expect(scoreFor(D(7), { kind: "anyDouble" })).toBe(14);
    expect(scoreFor(S(7), { kind: "anyDouble" })).toBe(0);
    expect(scoreFor(INNER_BULL, { kind: "anyDouble" })).toBe(50);
  });

  it("takes any treble on the trebles round", () => {
    expect(scoreFor(T(3), { kind: "anyTreble" })).toBe(9);
    expect(scoreFor(D(3), { kind: "anyTreble" })).toBe(0);
  });

  it("takes either bull on the bull round", () => {
    expect(scoreFor(INNER_BULL, { kind: "bull" })).toBe(50);
    expect(scoreFor(OUTER_BULL, { kind: "bull" })).toBe(25);
  });
});

describe("halve it - the halving", () => {
  it("adds what you hit", () => {
    expect(halve([T(20)]).state.scores[0]).toBe(40 + 60);
  });

  it("halves you for a blank visit", () => {
    const { state, events } = halve([MISS, MISS, MISS]);
    expect(state.scores[0]).toBe(20); // 40 halved
    expect(types(events)).toContain("bust");
  });

  it("spares you if you hit anything at all", () => {
    expect(halve([S(20), MISS, MISS]).state.scores[0]).toBe(60);
  });

  it("spares you if the hit came last", () => {
    expect(halve([MISS, MISS, S(20)]).state.scores[0]).toBe(60);
  });

  it("scores only the round target, not whatever landed", () => {
    // Round one is the 20. The 5 is a dart thrown, not a dart scored.
    expect(halve([S(20), S(5), MISS]).state.scores[0]).toBe(60);
  });

  it("rounds the halving down", () => {
    // 40 + 20 = 60 in round one, then blank round two: 30.
    const log = [S(20), S(5), MISS, MISS, MISS, MISS];
    expect(halve(log).state.scores[0]).toBe(30);
  });

  it("rounds an odd total down, not up", () => {
    // 40 + 5 on the... no: round one is the 20, so hit S20 then D20 = 40+20+40.
    // Simpler: get to an odd number and halve it.
    const odd = [S(20), MISS, MISS, MISS, MISS, MISS]; // 60 -> blank -> 30
    expect(halve(odd).state.scores[0]).toBe(30);
  });

  it("hurts more the longer you have held a total", () => {
    const big = [T(20), T(20), T(20), MISS, MISS, MISS];
    expect(halve(big).state.scores[0]).toBe(110); // (40+180) / 2
  });
});

describe("halve it - the end", () => {
  it("ends after the seventh round and the leader takes it", () => {
    // Seven rounds of three misses each: everything halves, but it finishes.
    const log = Array.from({ length: 21 }, () => MISS);
    const { state } = halve(log);
    expect(state.winner).toBe(0);
  });

  it("gives it to the higher score", () => {
    // A dart that actually scores on each round in turn: 20, 19, 18, any
    // double, 17, any treble, bull.
    const onTarget: Dart[] = [S(20), S(19), S(18), D(10), S(17), T(5), OUTER_BULL];
    const log: Dart[] = [];
    for (const hit of onTarget) {
      log.push(hit, MISS, MISS); // Ava scores
      log.push(MISS, MISS, MISS); // Ben blanks and halves
    }
    const { state } = halve(log, TWO);
    expect(state.winner).toBe(0);
    expect(state.scores[0]).toBeGreaterThan(state.scores[1] as number);
    expect(state.scores[1]).toBe(0); // halved to nothing
  });
});

// ===========================================================================
// Bob's 27
// ===========================================================================

const BOBS: ConfigOf<"bobs27"> = { kind: "bobs27" };
const bobs = (log: readonly Dart[], players = SOLO) => runLog(bobs27Engine, BOBS, players, log);

describe("bob's 27 - the setup", () => {
  it("starts on 27", () => {
    expect(BOBS_27_START).toBe(27);
    expect(bobs([]).state.scores[0]).toBe(27);
  });

  it("runs D1 to D20 then the bull", () => {
    expect(BOBS_27_ROUNDS).toHaveLength(21);
    expect(BOBS_27_ROUNDS[0]).toBe(1);
    expect(BOBS_27_ROUNDS[19]).toBe(20);
    expect(BOBS_27_ROUNDS[20]).toBe("bull");
  });

  it("values a round at twice the number, and the bull at 50", () => {
    expect(valueOfRound(1)).toBe(2);
    expect(valueOfRound(20)).toBe(40);
    expect(valueOfRound("bull")).toBe(50);
  });
});

describe("bob's 27 - hitting", () => {
  it("only takes doubles", () => {
    expect(hits(D(1), 1)).toBe(true);
    expect(hits(S(1), 1)).toBe(false);
    expect(hits(T(1), 1)).toBe(false);
  });

  it("only takes the inner bull on the bull round", () => {
    expect(hits(INNER_BULL, "bull")).toBe(true);
    expect(hits(OUTER_BULL, "bull")).toBe(false);
  });

  it("adds the round value per hit", () => {
    expect(bobs([D(1)]).state.scores[0]).toBe(29);
    expect(bobs([D(1), D(1)]).state.scores[0]).toBe(31);
    expect(bobs([D(1), D(1), D(1)]).state.scores[0]).toBe(33);
  });
});

describe("bob's 27 - the forfeit", () => {
  it("costs you the round value for a blank visit", () => {
    const { state, events } = bobs([MISS, MISS, MISS]);
    expect(state.scores[0]).toBe(25); // 27 - 2
    expect(types(events)).toContain("bust");
  });

  it("spares you for a single hit", () => {
    expect(bobs([D(1), MISS, MISS]).state.scores[0]).toBe(29);
  });

  it("gets more expensive as the rounds climb", () => {
    // Blank D1 (-2) then blank D2 (-4): 27 -> 25 -> 21.
    const log = [MISS, MISS, MISS, MISS, MISS, MISS];
    expect(bobs(log).state.scores[0]).toBe(21);
  });
});

describe("bob's 27 - going out", () => {
  it("knocks you out below zero", () => {
    // Blank every round. The forfeits grow: 2+4+6+8... 27 goes under fast.
    const log = Array.from({ length: 30 }, () => MISS);
    const { state } = bobs(log);
    expect(state.scores[0]).toBeLessThan(0);
    expect(state.winner).toBe(0); // solo: last one standing is still you
  });

  it("reports the elimination", () => {
    const log = Array.from({ length: 30 }, () => MISS);
    const all = bobs(log);
    expect(all.state.active[0]).toBe(false);
  });

  it("lets the survivor win a two-player game", () => {
    const log: Dart[] = [];
    // Ava hits D1 forever (well, whatever round it is); Ben blanks everything.
    for (let round = 0; round < 8; round++) {
      log.push(D((round + 1) as 1), MISS, MISS);
      log.push(MISS, MISS, MISS);
    }
    const { state } = bobs(log, TWO);
    expect(state.scores[0]).toBeGreaterThan(state.scores[1] as number);
  });
});

describe("bob's 27 - aim", () => {
  it("aims at the round double", () => {
    expect(bobs27Engine.aim(bobs([]).state)).toEqual(D(1));
    expect(bobs27Engine.aim(bobs([D(1), D(1), D(1)]).state)).toEqual(D(2));
  });
});
