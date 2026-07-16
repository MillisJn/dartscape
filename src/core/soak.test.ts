import { describe, expect, it } from "vitest";
import { type Dart, points } from "./board";
import { type Rng, SKILL, seeded, throwAt } from "./bot/bot";
import { DEFAULT_CONFIG, GAME_KINDS, type GameConfig, type Player } from "./game/config";
import { aim, type GameState, reduce, view } from "./game/registry";

/**
 * The soak suite.
 *
 * Everything else tests a rule with an example. This tests the *properties* that
 * must hold for every game, every seed, every seating — by having bots actually
 * play thousands of games and checking nothing ever goes wrong.
 *
 * These are the tests that catch what you didn't think of.
 */

const bot = (name: string, sigma: number): Player => ({ id: name, name, sigma });

const TWO = [bot("a", SKILL.HARD), bot("b", SKILL.MEDIUM)];
const THREE = [...TWO, bot("c", SKILL.EASY)];
const FOUR = [...THREE, bot("d", SKILL.EXPERT)];
const SEATINGS = { 1: [TWO[0] as Player], 2: TWO, 3: THREE, 4: FOUR };

/** Some games are long by design — baseball at-bats run until three outs. */
const DART_BUDGET = 4000;

interface Played {
  readonly log: Dart[];
  readonly state: GameState;
  readonly darts: number;
}

/** Play a game to a winner, or die trying. */
function play(config: GameConfig, players: readonly Player[], rng: Rng): Played {
  const log: Dart[] = [];
  for (let i = 0; i < DART_BUDGET; i++) {
    const { state } = reduce(config, players, log);
    if (state.winner !== null) return { log, state, darts: log.length };
    const seat = state.visit.seat;
    log.push(throwAt(aim(state), players[seat]?.sigma ?? 20, rng));
  }
  const { state } = reduce(config, players, log);
  return { log, state, darts: log.length };
}

const SEEDS = [1, 2, 3, 7, 11, 13, 42, 99, 256, 1024];

describe("every game finishes", () => {
  for (const kind of GAME_KINDS) {
    for (const count of [1, 2, 3, 4] as const) {
      it(`${kind} with ${count} player(s), across ${SEEDS.length} seeds`, () => {
        for (const seed of SEEDS) {
          const players = SEATINGS[count];
          const { state, darts } = play(DEFAULT_CONFIG[kind], players, seeded(seed));
          expect(state.winner, `${kind}/${count}p/seed ${seed} never finished`).not.toBeNull();
          expect(darts).toBeLessThan(DART_BUDGET);
        }
      });
    }
  }
});

describe("the log is the truth", () => {
  for (const kind of GAME_KINDS) {
    it(`${kind} replays identically`, () => {
      for (const seed of SEEDS.slice(0, 4)) {
        const config = DEFAULT_CONFIG[kind];
        const { log } = play(config, TWO, seeded(seed));
        const a = reduce(config, TWO, log).state;
        const b = reduce(config, TWO, log).state;
        expect(a).toEqual(b);
      }
    });

    it(`${kind} survives being rewound dart by dart`, () => {
      const config = DEFAULT_CONFIG[kind];
      const { log } = play(config, TWO, seeded(5));
      // Every prefix of a real log must be a real state. This is undo.
      for (let i = 0; i <= log.length; i++) {
        expect(() => reduce(config, TWO, log.slice(0, i))).not.toThrow();
      }
    });

    it(`${kind} rewinding the winning dart un-wins the game`, () => {
      const config = DEFAULT_CONFIG[kind];
      const { log, state } = play(config, TWO, seeded(3));
      if (state.winner === null || log.length === 0) return;
      const before = reduce(config, TWO, log.slice(0, -1)).state;
      expect(before.winner).toBeNull();
    });
  }
});

describe("invariants that must never break", () => {
  for (const kind of GAME_KINDS) {
    it(`${kind} keeps its state sane at every single dart`, () => {
      const config = DEFAULT_CONFIG[kind];
      const players = THREE;
      const { log } = play(config, players, seeded(17));

      for (let i = 0; i <= log.length; i++) {
        const { state } = reduce(config, players, log.slice(0, i));
        const where = `${kind} at dart ${i}`;

        // Seats stay in range and stay whole.
        expect(state.scores, where).toHaveLength(players.length);
        expect(state.active, where).toHaveLength(players.length);
        for (const score of state.scores) {
          expect(Number.isFinite(score), `${where}: score ${score}`).toBe(true);
          expect(Number.isInteger(score), `${where}: score ${score}`).toBe(true);
        }

        // The thrower is a real, live seat.
        expect(state.visit.seat, where).toBeGreaterThanOrEqual(0);
        expect(state.visit.seat, where).toBeLessThan(players.length);
        if (state.winner === null) {
          expect(state.active[state.visit.seat], `${where}: dead seat is throwing`).toBe(true);
        }

        // Three darts to a visit — except baseball, where an at-bat runs until
        // three outs and a hot batter can throw all night.
        if (kind !== "baseball") {
          expect(state.visit.darts.length, where).toBeLessThanOrEqual(3);
        }

        // Rounds only ever go up.
        expect(state.round, where).toBeGreaterThanOrEqual(0);

        // A winner is a real seat.
        if (state.winner !== null) {
          expect(state.winner, where).toBeGreaterThanOrEqual(0);
          expect(state.winner, where).toBeLessThan(players.length);
        }
      }
    });

    it(`${kind} never un-wins once won`, () => {
      const config = DEFAULT_CONFIG[kind];
      const { log } = play(config, TWO, seeded(23));
      let seenWinner: number | null = null;
      for (let i = 0; i <= log.length; i++) {
        const { state } = reduce(config, TWO, log.slice(0, i));
        if (seenWinner !== null) {
          expect(state.winner, `${kind} changed its mind at dart ${i}`).toBe(seenWinner);
        }
        if (state.winner !== null) seenWinner = state.winner;
      }
    });

    it(`${kind} ignores darts thrown after the win`, () => {
      const config = DEFAULT_CONFIG[kind];
      const { log, state } = play(config, TWO, seeded(31));
      if (state.winner === null) return;
      const extra = [...log, ...log.slice(0, 6)];
      expect(reduce(config, TWO, extra).state).toEqual(state);
    });

    it(`${kind} always produces a renderable view`, () => {
      const config = DEFAULT_CONFIG[kind];
      const { log } = play(config, TWO, seeded(37));
      for (let i = 0; i <= log.length; i += 3) {
        const v = view(reduce(config, TWO, log.slice(0, i)).state);
        expect(v.kind).toBe(kind);
        expect(v.players).toHaveLength(2);
        expect(v.panel.kind).toBe(kind);
        expect(v.visit.dartsLeft).toBeGreaterThanOrEqual(0);
      }
    });

    it(`${kind} always has somewhere to aim`, () => {
      const config = DEFAULT_CONFIG[kind];
      const { log } = play(config, TWO, seeded(41));
      for (let i = 0; i < log.length; i++) {
        const { state } = reduce(config, TWO, log.slice(0, i));
        if (state.winner !== null) break;
        expect(() => aim(state), `${kind} had no aim at dart ${i}`).not.toThrow();
      }
    });
  }
});

describe("bots play like players, not like dice", () => {
  /** Win rate of `a` over `games` legs of 501 against `b`. */
  function duel(sigmaA: number, sigmaB: number, games: number): number {
    const players = [bot("a", sigmaA), bot("b", sigmaB)];
    const config: GameConfig = { kind: "x01", start: 501, in: "straight", out: "double" };
    const rng = seeded(2026);
    let wins = 0;
    for (let i = 0; i < games; i++) {
      if (play(config, players, rng).state.winner === 0) wins++;
    }
    return wins / games;
  }

  it("a master beats a beginner nearly every time", () => {
    expect(duel(SKILL.MASTER, SKILL.BEGINNER, 40)).toBeGreaterThan(0.9);
  });

  it("a master beats a hard bot most of the time", () => {
    expect(duel(SKILL.MASTER, SKILL.HARD, 40)).toBeGreaterThan(0.75);
  });

  it("equal bots are a coin flip", () => {
    const rate = duel(SKILL.HARD, SKILL.HARD, 60);
    // First throw is worth something in darts, so allow a real edge.
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.75);
  });

  it("skill orders the whole ladder", () => {
    const tiers = [SKILL.BEGINNER, SKILL.NORMAL, SKILL.HARD, SKILL.EXPERT, SKILL.MASTER];
    const rates = tiers.map((s) => duel(s, SKILL.HARD, 24));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i], `tier ${i} should beat tier ${i - 1}`).toBeGreaterThanOrEqual(
        (rates[i - 1] as number) - 0.1,
      );
    }
  });
});

describe("a 501 leg looks like real darts", () => {
  const config: GameConfig = { kind: "x01", start: 501, in: "straight", out: "double" };

  function legStats(sigma: number, legs: number) {
    const players = [bot("solo", sigma)];
    const rng = seeded(2026);
    const dartCounts: number[] = [];
    let total = 0;
    let darts = 0;
    for (let i = 0; i < legs; i++) {
      const { log } = play(config, players, rng);
      dartCounts.push(log.length);
      darts += log.length;
      total += log.reduce((s, d) => s + points(d), 0);
    }
    return {
      average: (total / darts) * 3,
      meanDarts: dartCounts.reduce((a, b) => a + b, 0) / legs,
      bestLeg: Math.min(...dartCounts),
    };
  }

  it("a master throws a professional leg", () => {
    const s = legStats(SKILL.MASTER, 40);
    // Pros: 90-100 average, 15-18 darts a leg, best legs down to 12.
    expect(s.average).toBeGreaterThan(70);
    expect(s.average).toBeLessThan(110);
    expect(s.meanDarts).toBeGreaterThan(14);
    expect(s.meanDarts).toBeLessThan(30);
    expect(s.bestLeg).toBeGreaterThanOrEqual(9); // a nine-darter is the floor
  });

  it("a beginner grinds it out", () => {
    const s = legStats(SKILL.BEGINNER, 20);
    expect(s.average).toBeGreaterThan(15);
    expect(s.average).toBeLessThan(45);
    expect(s.meanDarts).toBeGreaterThan(30);
  });

  it("nobody ever throws a leg in under nine darts", () => {
    // 501 in nine is the theoretical minimum. If this ever fails, the scoring
    // is wrong somewhere.
    for (const sigma of [SKILL.PERFECT, SKILL.MASTER, SKILL.HARD]) {
      const s = legStats(sigma, 15);
      expect(s.bestLeg, `sigma ${sigma} threw an impossible leg`).toBeGreaterThanOrEqual(9);
    }
  });

  it("a perfect bot approaches the nine-darter", () => {
    expect(legStats(SKILL.PERFECT, 20).meanDarts).toBeLessThan(15);
  });
});
