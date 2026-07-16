import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, MISS } from "../board";
import type { ConfigOf, Player } from "./config";
import { runLog } from "./engine";
import type { GameEvent } from "./events";
import { killerEngine } from "./killer";

const TWO: readonly Player[] = [
  { id: "a", name: "Ava" },
  { id: "b", name: "Ben" },
];

const cfg = (over: Partial<ConfigOf<"killer">> = {}): ConfigOf<"killer"> => ({
  kind: "killer",
  lives: 3,
  target: "double",
  oneKiller: false,
  ...over,
});

const play = (config: ConfigOf<"killer">, log: readonly Dart[], players = TWO) =>
  runLog(killerEngine, config, players, log);

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);
const types = (e: readonly GameEvent[]) => e.map((x) => x.type);

/** Both seats claim: seat 0 takes 20, seat 1 takes 19. */
const CLAIMED: Dart[] = [S(20), S(19)];

describe("killer - claiming", () => {
  it("starts in the claim phase with everyone on full lives", () => {
    const { state } = play(cfg(), []);
    expect(state.phase).toBe("claim");
    expect(state.scores).toEqual([3, 3]);
    expect(state.claimed).toEqual([null, null]);
  });

  it("claims a number and hands over immediately", () => {
    const { state, events } = play(cfg(), [S(20)]);
    expect(state.claimed).toEqual([20, null]);
    expect(state.visit.seat).toBe(1);
    expect(types(events)).toContain("numberClaimed");
  });

  it("refuses a number somebody already owns", () => {
    const { state, events } = play(cfg(), [S(20), S(20)]);
    expect(state.claimed).toEqual([20, null]);
    expect(types(events)).toContain("dartMissed");
  });

  it("moves to the kill phase once everyone has one", () => {
    expect(play(cfg(), CLAIMED).state.phase).toBe("kill");
  });

  it("takes the claim off any ring", () => {
    expect(play(cfg(), [T(20)]).state.claimed).toEqual([20, null]);
  });
});

describe("killer - becoming a killer", () => {
  it("needs your own double", () => {
    const { state, events } = play(cfg(), [...CLAIMED, D(20)]);
    expect(state.killers[0]).toBe(true);
    expect(types(events)).toContain("becameKiller");
  });

  it("will not take a single on the double rule", () => {
    const { state } = play(cfg(), [...CLAIMED, S(20)]);
    expect(state.killers[0]).toBe(false);
  });

  it("takes any hit on the single rule - the old app behaviour", () => {
    const single = cfg({ target: "single" });
    const { state } = play(single, [...CLAIMED, S(20)]);
    expect(state.killers[0]).toBe(true);
  });

  it("lets several players be killers at once by default", () => {
    const log = [...CLAIMED, D(20), MISS, MISS, D(19)];
    expect(play(cfg(), log).state.killers).toEqual([true, true]);
  });

  it("allows only one killer in oneKiller mode", () => {
    const log = [...CLAIMED, D(20), MISS, MISS, D(19)];
    const { state, events } = play(cfg({ oneKiller: true }), log);
    expect(state.killers).toEqual([false, true]);
    expect(types(events)).toContain("lostKillerStatus");
  });
});

describe("killer - taking lives", () => {
  it("takes a life off the owner of the number you hit", () => {
    const log = [...CLAIMED, D(20), D(19)];
    const { state, events } = play(cfg(), log);
    expect(state.scores).toEqual([3, 2]);
    expect(types(events)).toContain("lifeLost");
  });

  it("does nothing if you are not a killer yet", () => {
    const log = [...CLAIMED, D(19)];
    expect(play(cfg(), log).state.scores).toEqual([3, 3]);
  });

  it("costs you a life to hit your own double once you are a killer", () => {
    const log = [...CLAIMED, D(20), D(20)];
    const { state } = play(cfg(), log);
    expect(state.scores).toEqual([2, 3]);
  });

  it("ignores a number nobody owns", () => {
    const log = [...CLAIMED, D(20), D(7)];
    const { state, events } = play(cfg(), log);
    expect(state.scores).toEqual([3, 3]);
    expect(types(events)).toContain("dartMissed");
  });
});

describe("killer - elimination and winning", () => {
  /**
   * Seat 0 becomes killer and takes two lives, which uses up its three darts.
   * Seat 1's visit is burned on misses, then seat 0 comes back for the kill.
   */
  const TO_THE_DEATH = [
    ...CLAIMED,
    D(20),
    D(19),
    D(19), // seat 0: killer, then 3 -> 2 -> 1
    MISS,
    MISS,
    MISS, // seat 1 does nothing
    D(19), // seat 0 finishes it
  ];

  it("knocks a player out at zero lives and ends it", () => {
    const { state, events } = play(cfg(), TO_THE_DEATH);
    expect(state.scores[1]).toBe(0);
    expect(state.active[1]).toBe(false);
    expect(state.winner).toBe(0);
    expect(types(events)).toContain("eliminated");
    expect(types(events)).toContain("won");
  });

  it("never goes below zero lives", () => {
    expect(play(cfg(), [...TO_THE_DEATH, D(19)]).state.scores[1]).toBe(0);
  });

  it("stops a dead player from being hit again", () => {
    expect(play(cfg(), [...TO_THE_DEATH, D(19)]).state.winner).toBe(0);
  });

  it("respects a different life count", () => {
    const log = [...CLAIMED, D(20), D(19)];
    expect(play(cfg({ lives: 1 }), log).state.winner).toBe(0);
  });
});

describe("killer - undo is just a shorter log", () => {
  it("rewinds a claim", () => {
    expect(play(cfg(), [S(20)]).state.claimed).toEqual([20, null]);
    expect(play(cfg(), []).state.claimed).toEqual([null, null]);
  });

  it("rewinds an elimination", () => {
    const log = [...CLAIMED, D(20), D(19), D(19), MISS, MISS, MISS, D(19)];
    expect(play(cfg(), log).state.winner).toBe(0);
    const undone = play(cfg(), log.slice(0, -1)).state;
    expect(undone.winner).toBeNull();
    expect(undone.active[1]).toBe(true);
    expect(undone.scores[1]).toBe(1);
  });
});

describe("killer - aim", () => {
  it("claims the best free number", () => {
    expect(killerEngine.aim(play(cfg(), []).state)).toEqual(S(20));
  });

  it("claims the next one down once 20 is taken", () => {
    expect(killerEngine.aim(play(cfg(), [S(20)]).state)).toEqual(S(19));
  });

  it("goes for its own double to earn the status", () => {
    expect(killerEngine.aim(play(cfg(), CLAIMED).state)).toEqual(D(20));
  });

  it("goes after the healthiest opponent once it is a killer", () => {
    const { state } = play(cfg(), [...CLAIMED, D(20)]);
    expect(killerEngine.aim(state)).toEqual(D(19));
  });
});

describe("killer - view", () => {
  it("shows numbers, lives and status", () => {
    const { state } = play(cfg(), [...CLAIMED, D(20)]);
    const view = killerEngine.view(state);
    expect(view.panel).toMatchObject({
      kind: "killer",
      phase: "kill",
      seats: [
        { target: 20, lives: 3, isKiller: true },
        { target: 19, lives: 3, isKiller: false },
      ],
    });
  });
});
