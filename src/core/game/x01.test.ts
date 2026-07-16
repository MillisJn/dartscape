import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, INNER_BULL, MISS } from "../board";
import type { ConfigOf, Player } from "./config";
import { runLog } from "./engine";
import type { GameEvent } from "./events";
import { type X01State, x01Engine } from "./x01";

const HUMANS: readonly Player[] = [
  { id: "a", name: "Ava" },
  { id: "b", name: "Ben" },
];
const SOLO: readonly Player[] = [{ id: "a", name: "Ava" }];

const cfg = (over: Partial<ConfigOf<"x01">> = {}): ConfigOf<"x01"> => ({
  kind: "x01",
  start: 501,
  in: "straight",
  out: "double",
  ...over,
});

/**
 * A config starting from an arbitrary score. Real games only start on the seven
 * standard values, which is why X01Start is a literal union - but a test that
 * wants to examine a checkout shouldn't have to throw 20 darts to get there.
 */
const from = (start: number, over: Partial<ConfigOf<"x01">> = {}): ConfigOf<"x01"> =>
  cfg({ ...over, start: start as ConfigOf<"x01">["start"] });

const play = (config: ConfigOf<"x01">, log: readonly Dart[], players = HUMANS) =>
  runLog(x01Engine, config, players, log);

/**
 * A solo game sitting on `score` at the start of a fresh visit. Driving the
 * engine directly beats walking the score down with real darts: the walk itself
 * has visits and busts, which is exactly what these tests are trying to isolate.
 */
function sittingOn(score: number, config = cfg()): X01State {
  const init = x01Engine.init(config, SOLO);
  return {
    ...init,
    scores: [score],
    opened: [true],
    visit: { seat: 0, darts: [], scoresAtVisitStart: [score] },
  };
}

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);

const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

describe("x01 - setup", () => {
  it("starts everyone on the start score", () => {
    const { state } = play(cfg({ start: 301 }), []);
    expect(state.scores).toEqual([301, 301]);
    expect(state.winner).toBeNull();
    expect(state.visit.seat).toBe(0);
  });

  it("opens everyone immediately on straight-in", () => {
    expect(play(cfg({ in: "straight" }), []).state.opened).toEqual([true, true]);
  });

  it("opens nobody on double-in", () => {
    expect(play(cfg({ in: "double" }), []).state.opened).toEqual([false, false]);
  });
});

describe("x01 - scoring", () => {
  it("subtracts a dart", () => {
    expect(play(cfg(), [T(20)]).state.scores[0]).toBe(441);
  });

  it("subtracts a full visit and hands over", () => {
    const { state } = play(cfg(), [T(20), T(20), T(20)]);
    expect(state.scores[0]).toBe(321);
    expect(state.visit.seat).toBe(1);
    expect(state.visit.darts).toEqual([]);
  });

  it("counts a miss as a dart but not as points", () => {
    const { state } = play(cfg(), [MISS, MISS]);
    expect(state.scores[0]).toBe(501);
    expect(state.visit.darts).toHaveLength(2);
  });

  it("alternates seats and counts rounds", () => {
    const { state } = play(cfg(), [T(20), T(20), T(20), T(19), T(19), T(19)]);
    expect(state.scores).toEqual([321, 330]);
    expect(state.visit.seat).toBe(0);
    expect(state.round).toBe(1);
  });

  it("a maximum is 180", () => {
    expect(play(cfg(), [T(20), T(20), T(20)]).state.scores[0]).toBe(501 - 180);
  });
});

describe("x01 - the in-rule", () => {
  it("ignores points until you double in", () => {
    const { state, events } = play(cfg({ in: "double" }), [T(20)]);
    expect(state.scores[0]).toBe(501);
    expect(state.opened[0]).toBe(false);
    expect(types(events)).toContain("notOpenedYet");
  });

  it("opens on a double and scores it", () => {
    const { state, events } = play(cfg({ in: "double" }), [D(20)]);
    expect(state.scores[0]).toBe(461);
    expect(state.opened[0]).toBe(true);
    expect(types(events)).toContain("opened");
  });

  it("accepts the bull as a double-in", () => {
    const { state } = play(cfg({ in: "double" }), [INNER_BULL]);
    expect(state.opened[0]).toBe(true);
    expect(state.scores[0]).toBe(451);
  });

  it("scores freely once opened", () => {
    expect(play(cfg({ in: "double" }), [D(20), T(20)]).state.scores[0]).toBe(401);
  });

  it("needs a treble on treble-in", () => {
    expect(play(cfg({ in: "treble" }), [D(20)]).state.opened[0]).toBe(false);
    expect(play(cfg({ in: "treble" }), [T(20)]).state.opened[0]).toBe(true);
  });
});

describe("x01 - busts", () => {
  it("busts below zero and restores the visit", () => {
    const { state, events } = x01Engine.step(sittingOn(20), T(20));
    expect(state.scores[0]).toBe(20);
    expect(types(events)).toContain("bust");
  });

  it("busts when it would leave 1 on double-out", () => {
    const { state, events } = x01Engine.step(sittingOn(20), S(19));
    expect(state.scores[0]).toBe(20);
    expect(types(events)).toContain("bust");
  });

  it("busts on zero reached without a double", () => {
    const { state, events } = x01Engine.step(sittingOn(20), S(20));
    expect(state.scores[0]).toBe(20);
    expect(state.winner).toBeNull();
    expect(types(events)).toContain("bust");
  });

  it("does not bust leaving 2 on double-out", () => {
    expect(x01Engine.step(sittingOn(20), S(18)).state.scores[0]).toBe(2);
  });

  it("ends the visit immediately", () => {
    expect(x01Engine.step(sittingOn(20), T(20)).endVisit).toBe(true);
  });

  it("restores the whole visit, not just the busting dart", () => {
    // A visit opening on 60: S20 leaves 40, S20 leaves 20, then T20 busts back to 60.
    const { state } = play(from(60), [S(20), S(20), T(20)], SOLO);
    expect(state.scores[0]).toBe(60);
  });

  it("leaves 1 unfinishable but 2 fine on master-out", () => {
    const master = cfg({ out: "master" });
    expect(types(x01Engine.step(sittingOn(20, master), S(19)).events)).toContain("bust");
    expect(x01Engine.step(sittingOn(20, master), S(18)).state.scores[0]).toBe(2);
  });
});

describe("x01 - checkout", () => {
  it("wins on an exact double", () => {
    const { state, events } = x01Engine.step(sittingOn(40), D(20));
    expect(state.scores[0]).toBe(0);
    expect(state.winner).toBe(0);
    expect(types(events)).toContain("won");
    expect(types(events)).toContain("checkout");
  });

  it("wins on the bull", () => {
    expect(x01Engine.step(sittingOn(50), INNER_BULL).state.winner).toBe(0);
  });

  it("wins on any dart with straight-out", () => {
    const straight = cfg({ out: "straight" });
    expect(x01Engine.step(sittingOn(20, straight), S(20)).state.winner).toBe(0);
  });

  it("reports points and darts used", () => {
    const { events } = play(from(100), [T(20), D(20)], SOLO);
    expect(events.find((e) => e.type === "checkout")).toMatchObject({
      points: 100,
      darts: 2,
    });
  });

  it("stops the game once won - later darts do nothing", () => {
    const { state } = play(from(40), [D(20), T(20), T(20)], SOLO);
    expect(state.winner).toBe(0);
    expect(state.scores[0]).toBe(0);
  });
});

describe("x01 - undo is just a shorter log", () => {
  it("rewinds by dropping the last dart", () => {
    const log = [T(20), T(20), T(20), T(19)];
    expect(play(cfg(), log).state.scores[1]).toBe(444);
    expect(play(cfg(), log.slice(0, -1)).state.scores[1]).toBe(501);
  });

  it("rewinds through a bust with no special handling", () => {
    const log = [S(20), S(20), T(20)]; // from 60: 40, 20, bust back to 60
    expect(play(from(60), log.slice(0, 2), SOLO).state.scores[0]).toBe(20);
    expect(play(from(60), log, SOLO).state.scores[0]).toBe(60);
  });

  it("rewinds a win", () => {
    const log = [T(20), D(20)];
    expect(play(from(100), log, SOLO).state.winner).toBe(0);
    expect(play(from(100), log.slice(0, 1), SOLO).state.winner).toBeNull();
  });

  it("is deterministic - same log, same state", () => {
    const log = [T(20), S(5), MISS, D(10), T(19)];
    expect(play(cfg(), log).state).toEqual(play(cfg(), log).state);
  });
});

describe("x01 - aim", () => {
  it("goes for T20 when scoring", () => {
    expect(x01Engine.aim(sittingOn(501))).toEqual(T(20));
  });

  it("goes for T19 when the thrower is a weak bot", () => {
    const weak: Player[] = [{ id: "w", name: "Wobble", sigma: 45 }];
    const { state } = play(cfg(), [], weak);
    expect(x01Engine.aim(state)).toEqual(T(19));
  });

  it("goes for the double-in when it has to", () => {
    const { state } = play(cfg({ in: "double" }), []);
    expect(x01Engine.aim(state)).toEqual(D(20));
  });

  it("takes the double when sitting on one", () => {
    expect(x01Engine.aim(sittingOn(40))).toEqual(D(20));
  });

  it("sets up rather than chasing a finish it cannot reach", () => {
    // 170 needs three darts; with one left, go back to scoring.
    const state = sittingOn(170);
    const twoThrown: X01State = {
      ...state,
      visit: { ...state.visit, darts: [MISS, MISS] },
    };
    expect(x01Engine.aim(twoThrown)).toEqual(T(20));
  });

  it("starts the big fish on T20 with three darts in hand", () => {
    expect(x01Engine.aim(sittingOn(170))).toEqual(T(20));
  });
});
