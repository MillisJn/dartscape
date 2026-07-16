import { describe, expect, it } from "vitest";
import { type Bed, bed, type Dart, INNER_BULL, MISS, OUTER_BULL } from "../board";
import type { ConfigOf, Player } from "./config";
import { type CricketState, cricketEngine, targetOf } from "./cricket";
import { runLog } from "./engine";
import type { GameEvent } from "./events";

const TWO: readonly Player[] = [
  { id: "a", name: "Ava" },
  { id: "b", name: "Ben" },
];
const SOLO: readonly Player[] = [{ id: "a", name: "Ava" }];

const cfg = (scoring: ConfigOf<"cricket">["scoring"] = "points"): ConfigOf<"cricket"> => ({
  kind: "cricket",
  scoring,
});

const play = (config: ConfigOf<"cricket">, log: readonly Dart[], players = TWO) =>
  runLog(cricketEngine, config, players, log);

const T = (w: Parameters<typeof bed>[1]): Bed => bed("treble", w);
const D = (w: Parameters<typeof bed>[1]): Bed => bed("double", w);
const S = (w: Parameters<typeof bed>[1]): Bed => bed("single", w);
const types = (e: readonly GameEvent[]) => e.map((x) => x.type);

/** Seat 0's marks on 20 (index 0). */
const marks20 = (s: CricketState, seat = 0) => s.marks[seat]?.[0];

describe("targetOf", () => {
  it("accepts 15 through 20 and the bull", () => {
    expect(targetOf(T(20))).toBe(20);
    expect(targetOf(S(15))).toBe(15);
    expect(targetOf(INNER_BULL)).toBe("bull");
    expect(targetOf(OUTER_BULL)).toBe("bull");
  });

  it("rejects everything else", () => {
    expect(targetOf(T(14))).toBeNull();
    expect(targetOf(S(1))).toBeNull();
    expect(targetOf(MISS)).toBeNull();
  });
});

describe("cricket — marking", () => {
  it("marks one for a single, two for a double, three for a treble", () => {
    expect(marks20(play(cfg(), [S(20)]).state)).toBe(1);
    expect(marks20(play(cfg(), [D(20)]).state)).toBe(2);
    expect(marks20(play(cfg(), [T(20)]).state)).toBe(3);
  });

  it("marks one for the outer bull and two for the inner — the league rule", () => {
    const outer = play(cfg(), [OUTER_BULL]).state;
    const inner = play(cfg(), [INNER_BULL]).state;
    expect(outer.marks[0]?.[6]).toBe(1);
    expect(inner.marks[0]?.[6]).toBe(2);
  });

  it("ignores numbers that are not on the sheet", () => {
    const { state, events } = play(cfg(), [T(14)]);
    expect(state.marks[0]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(types(events)).toContain("dartMissed");
  });

  it("caps marks at three", () => {
    expect(marks20(play(cfg(), [T(20), T(20)]).state)).toBe(3);
  });

  it("announces a close", () => {
    expect(types(play(cfg(), [T(20)]).events)).toContain("targetClosed");
  });

  it("announces a close only once", () => {
    expect(types(play(cfg(), [T(20), S(20)]).events)).not.toContain("targetClosed");
  });
});

describe("cricket — points", () => {
  it("scores nothing while the number is still open for you", () => {
    expect(play(cfg(), [D(20)]).state.scores).toEqual([0, 0]);
  });

  it("scores the overflow when you close with a treble on two marks", () => {
    // D20 (2 marks), then T20: 1 mark closes, 2 overflow = 40.
    expect(play(cfg(), [D(20), T(20)]).state.scores[0]).toBe(40);
  });

  it("scores every mark once closed", () => {
    expect(play(cfg(), [T(20), T(20)]).state.scores[0]).toBe(60);
  });

  it("scores the bull at 25 a mark", () => {
    expect(play(cfg(), [INNER_BULL, INNER_BULL, INNER_BULL]).state.scores[0]).toBe(75);
  });

  it("stops scoring once the opponent closes it too", () => {
    // Seat 0 closes 20. Seat 1 closes 20. Now 20 is dead for everyone.
    const log = [T(20), MISS, MISS, T(20), MISS, MISS, T(20)];
    const { state } = play(cfg(), log);
    expect(state.scores[0]).toBe(0);
  });

  it("marks a target dead once everyone has closed it", () => {
    const log = [T(20), MISS, MISS, T(20)];
    expect(types(play(cfg(), log).events)).toContain("targetDead");
  });

  it("scores nothing at all in no-points", () => {
    expect(play(cfg("noPoints"), [T(20), T(20)]).state.scores[0]).toBe(0);
  });
});

describe("cricket — cut-throat", () => {
  it("gives your points to everyone who has not closed it", () => {
    const { state } = play(cfg("cutThroat"), [T(20), T(20)]);
    expect(state.scores).toEqual([0, 60]);
  });

  it("spares anyone who has already closed it", () => {
    const three: Player[] = [
      { id: "a", name: "Ava" },
      { id: "b", name: "Ben" },
      { id: "c", name: "Cy" },
    ];
    // Seat 0 closes 20; seat 1 closes 20; seat 2 misses. Seat 0 then scores 60,
    // which should land only on seat 2.
    const log = [T(20), MISS, MISS, T(20), MISS, MISS, MISS, MISS, MISS, T(20)];
    const { state } = play(cfg("cutThroat"), log, three);
    expect(state.scores).toEqual([0, 0, 60]);
  });
});

describe("cricket — winning", () => {
  const closeAll: Dart[] = [T(20), T(19), T(18), T(17), T(16), T(15), INNER_BULL, OUTER_BULL];

  it("needs everything closed and the lead", () => {
    const { state, events } = play(cfg(), closeAll, SOLO);
    expect(state.winner).toBe(0);
    expect(types(events)).toContain("won");
  });

  it("does not win with everything closed but behind on points", () => {
    // Seat 1 banks 60 on the 19 first, then seat 0 closes out with no points.
    const log: Dart[] = [
      MISS,
      MISS,
      MISS,
      T(19),
      T(19),
      MISS, // seat 1 closes 19 and scores 57... plus overflow
      T(20),
      T(18),
      T(17),
      MISS,
      MISS,
      MISS,
      T(16),
      T(15),
      INNER_BULL,
      MISS,
      MISS,
      MISS,
      OUTER_BULL,
      T(19),
      MISS,
    ];
    const { state } = play(cfg(), log);
    // Seat 0 has closed everything but seat 1 leads, so no winner yet.
    expect(state.scores[1]).toBeGreaterThan(state.scores[0] as number);
    expect(state.winner).toBeNull();
  });

  it("wins in no-points on closing alone", () => {
    expect(play(cfg("noPoints"), closeAll, SOLO).state.winner).toBe(0);
  });

  it("wins cut-throat on the lowest score", () => {
    const { state } = play(cfg("cutThroat"), closeAll, SOLO);
    expect(state.winner).toBe(0);
  });
});

describe("cricket — undo is just a shorter log", () => {
  it("rewinds marks and points together", () => {
    const log = [D(20), T(20)];
    const full = play(cfg(), log).state;
    const undone = play(cfg(), log.slice(0, -1)).state;
    expect(full.scores[0]).toBe(40);
    expect(marks20(full)).toBe(3);
    expect(undone.scores[0]).toBe(0);
    expect(marks20(undone)).toBe(2);
  });
});

describe("cricket — aim", () => {
  it("starts on the 20", () => {
    const { state } = play(cfg(), []);
    expect(cricketEngine.aim(state)).toEqual(T(20));
  });

  it("moves to the next open number once 20 is closed", () => {
    const { state } = play(cfg(), [T(20)]);
    expect(cricketEngine.aim(state)).toEqual(T(19));
  });

  it("aims the inner bull for the bull", () => {
    const log = [T(20), T(19), T(18), T(17), T(16), T(15)];
    const { state } = play(cfg(), log, SOLO);
    expect(cricketEngine.aim(state)).toEqual({ ring: "innerBull" });
  });
});

describe("cricket — view", () => {
  it("lays out one row per target", () => {
    const { state } = play(cfg(), [T(20)]);
    const view = cricketEngine.view(state);
    expect(view.panel.kind).toBe("cricket");
    if (view.panel.kind !== "cricket") throw new Error("wrong panel");
    expect(view.panel.rows).toHaveLength(7);
    expect(view.panel.rows[0]).toMatchObject({ target: 20, marks: [3, 0], dead: false });
    expect(view.panel.rows[6]?.target).toBe("bull");
  });
});
