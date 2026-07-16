import { describe, expect, it } from "vitest";
import {
  describeFormat,
  type LegResult,
  type MatchFormat,
  majority,
  matchState,
  nextSeating,
} from "./match";

const PLAYERS = ["ava", "ben"];
const legs = (...winners: string[]): LegResult[] => winners.map((winner) => ({ winner }));

describe("majority", () => {
  it("is what best-of means", () => {
    expect(majority(1)).toBe(1);
    expect(majority(3)).toBe(2);
    expect(majority(5)).toBe(3);
    expect(majority(7)).toBe(4);
  });
});

describe("single game", () => {
  const format: MatchFormat = { kind: "single" };

  it("has no winner before anyone wins", () => {
    expect(matchState(format, PLAYERS, []).winner).toBeNull();
  });

  it("is over after one leg", () => {
    expect(matchState(format, PLAYERS, legs("ava")).winner).toBe("ava");
  });
});

describe("leg race", () => {
  const format: MatchFormat = { kind: "legRace", legs: 3 };

  it("needs all N legs, not a majority", () => {
    expect(matchState(format, PLAYERS, legs("ava", "ava")).winner).toBeNull();
    expect(matchState(format, PLAYERS, legs("ava", "ava", "ava")).winner).toBe("ava");
  });

  it("counts legs per player", () => {
    const m = matchState(format, PLAYERS, legs("ava", "ben", "ava"));
    expect(m.legs).toEqual({ ava: 2, ben: 1 });
    expect(m.winner).toBeNull();
  });

  it("ignores legs played after it was already won", () => {
    const m = matchState(format, PLAYERS, legs("ava", "ava", "ava", "ben", "ben"));
    expect(m.winner).toBe("ava");
    expect(m.legs).toEqual({ ava: 3, ben: 0 });
  });
});

describe("set match", () => {
  const format: MatchFormat = { kind: "setMatch", legs: 3, sets: 3 };

  it("takes a set on a majority of legs and resets the legs", () => {
    const m = matchState(format, PLAYERS, legs("ava", "ava"));
    expect(m.sets).toEqual({ ava: 1, ben: 0 });
    expect(m.legs).toEqual({ ava: 0, ben: 0 });
    expect(m.winner).toBeNull();
  });

  it("needs a majority of sets to take the match", () => {
    const m = matchState(format, PLAYERS, legs("ava", "ava", "ava", "ava"));
    expect(m.sets).toEqual({ ava: 2, ben: 0 });
    expect(m.winner).toBe("ava");
  });

  it("carries legs within a set", () => {
    const m = matchState(format, PLAYERS, legs("ava", "ben"));
    expect(m.legs).toEqual({ ava: 1, ben: 1 });
    expect(m.sets).toEqual({ ava: 0, ben: 0 });
  });

  it("plays a full three-set match out", () => {
    const results = legs(
      "ava",
      "ava", // set 1 to ava
      "ben",
      "ben", // set 2 to ben
      "ava",
      "ben",
      "ava", // set 3 to ava
    );
    const m = matchState(format, PLAYERS, results);
    expect(m.sets).toEqual({ ava: 2, ben: 1 });
    expect(m.winner).toBe("ava");
  });
});

describe("undo is just a shorter list", () => {
  it("rewinds a match win", () => {
    const format: MatchFormat = { kind: "legRace", legs: 2 };
    const all = legs("ava", "ava");
    expect(matchState(format, PLAYERS, all).winner).toBe("ava");
    expect(matchState(format, PLAYERS, all.slice(0, -1)).winner).toBeNull();
  });
});

describe("describeFormat", () => {
  it("reads like a scoreboard", () => {
    expect(describeFormat({ kind: "single" })).toBe("");
    expect(describeFormat({ kind: "legRace", legs: 3 })).toBe("RACE TO 3 LEGS");
    expect(describeFormat({ kind: "legRace", legs: 1 })).toBe("RACE TO 1 LEG");
    expect(describeFormat({ kind: "setMatch", legs: 5, sets: 3 })).toBe("BEST OF 5 LEGS - 3 SETS");
  });
});

describe("seating", () => {
  const seating = ["a", "b", "c", "d"];
  const ranking = ["c", "a", "d", "b"]; // c won, b came last

  it("leaves it alone", () => {
    expect(nextSeating("unchanged", seating, ranking)).toEqual(seating);
  });

  it("puts the winner first, keeping the rotation", () => {
    expect(nextSeating("winnerFirst", seating, ranking)).toEqual(["c", "d", "a", "b"]);
  });

  it("puts the loser first", () => {
    expect(nextSeating("loserFirst", seating, ranking)).toEqual(["b", "c", "d", "a"]);
  });

  it("seats best to worst", () => {
    expect(nextSeating("bestToWorst", seating, ranking)).toEqual(ranking);
  });

  it("seats worst to best", () => {
    expect(nextSeating("worstToBest", seating, ranking)).toEqual(["b", "d", "a", "c"]);
  });

  it("flips the table", () => {
    expect(nextSeating("flip", seating, ranking)).toEqual(["d", "c", "b", "a"]);
  });

  it("copes with no ranking yet", () => {
    expect(nextSeating("winnerFirst", seating, [])).toEqual(seating);
  });

  it("never loses or duplicates a player", () => {
    const rules = [
      "unchanged",
      "winnerFirst",
      "loserFirst",
      "bestToWorst",
      "worstToBest",
      "flip",
    ] as const;
    for (const rule of rules) {
      const next = nextSeating(rule, seating, ranking);
      expect([...next].sort(), rule).toEqual([...seating].sort());
    }
  });
});
