import { type Dart, isBed, marks, points, type Wedge } from "../board";
import type { GameConfig, Player } from "../game/config";
import { targetOf } from "../game/cricket";
import type { DartRecord } from "../game/engine";
import { reduce } from "../game/registry";

/**
 * Stats, derived from the log.
 *
 * The old `PlayerStats` accumulated counters while walking a flat throw list,
 * and worked out where one game ended and the next began by comparing
 * timestamps between adjacent throws. Here games are records, boundaries are
 * structural, and every number below is a pure function of what was thrown.
 *
 * That's not tidiness for its own sake: checkout percentage is impossible to
 * reconstruct from the old schema (it stores totals, not darts) and free from
 * this one. Store the log, compute the rest.
 */

export interface CompletedGame {
  readonly id: string;
  readonly config: GameConfig;
  /** In seat order. */
  readonly players: readonly Player[];
  readonly log: readonly Dart[];
  readonly winner: number | null;
  readonly playedAt: number;
}

export interface Stats {
  // --- universal ---
  readonly games: number;
  readonly wins: number;
  readonly winPercent: number;
  readonly darts: number;
  /** Darts that scored anything. */
  readonly hits: number;
  readonly hitPercent: number;
  readonly trebles: number;
  readonly doubles: number;
  readonly singles: number;
  readonly innerBulls: number;
  readonly outerBulls: number;
  readonly bestNumber: Wedge | null;
  readonly worstNumber: Wedge | null;
  /** (MPR x 10) + PPD — the NDA soft-tip handicap number leagues rank by. */
  readonly rating: number;

  // --- x01 ---
  readonly ppd: number;
  /** PPD x 3. The number every broadcast quotes. */
  readonly threeDartAverage: number;
  /** Scoring power, before the finish drags the average down. */
  readonly firstNineAverage: number;
  /** Doubles converted, as a percentage of darts thrown at one. */
  readonly checkoutPercent: number;
  readonly checkoutAttempts: number;
  readonly checkoutsHit: number;
  readonly highCheckout: number;
  /** Fewest darts used to win a leg. */
  readonly bestLeg: number | null;
  readonly maximums: number;
  readonly ton140s: number;
  readonly ton100s: number;
  readonly score60s: number;
  readonly bestVisit: number;

  // --- cricket ---
  /** Marks per round: marks / darts x 3. Pro cricket is 4.0+. */
  readonly mpr: number;
  readonly marks: number;

  // --- other games ---
  readonly shanghais: number;
  readonly kills: number;
  readonly homeRuns: number;
  readonly grandSlams: number;
  readonly runs: number;
  readonly innings: number;
  readonly runsPerInning: number;
  readonly bestInning: number;
  readonly highScore: number;
}

const EMPTY: Stats = {
  games: 0,
  wins: 0,
  winPercent: 0,
  darts: 0,
  hits: 0,
  hitPercent: 0,
  trebles: 0,
  doubles: 0,
  singles: 0,
  innerBulls: 0,
  outerBulls: 0,
  bestNumber: null,
  worstNumber: null,
  rating: 0,
  ppd: 0,
  threeDartAverage: 0,
  firstNineAverage: 0,
  checkoutPercent: 0,
  checkoutAttempts: 0,
  checkoutsHit: 0,
  highCheckout: 0,
  bestLeg: null,
  maximums: 0,
  ton140s: 0,
  ton100s: 0,
  score60s: 0,
  bestVisit: 0,
  mpr: 0,
  marks: 0,
  shanghais: 0,
  kills: 0,
  homeRuns: 0,
  grandSlams: 0,
  runs: 0,
  innings: 0,
  runsPerInning: 0,
  bestInning: 0,
  highScore: 0,
};

const ratio = (a: number, b: number): number => (b === 0 ? 0 : a / b);

/**
 * Is this dart an attempt at a finish?
 *
 * The honest definition without asking the player: they were sitting on a score
 * a single dart could finish, so whatever they threw, they were throwing at a
 * double. This is the standard "darts at double" heuristic every scoring app
 * uses, and it's why we need the score *before* each dart.
 */
function isCheckoutAttempt(rec: DartRecord, config: GameConfig): boolean {
  if (config.kind !== "x01") return false;
  const score = rec.scoreBefore;
  if (score <= 0 || score > 50) return false;
  // Finishable with one dart? 2..40 even, or 50 on the bull.
  if (config.out === "double") return (score <= 40 && score % 2 === 0) || score === 50;
  if (config.out === "treble") return score <= 60 && score % 3 === 0;
  if (config.out === "master") {
    return (score <= 40 && score % 2 === 0) || (score <= 60 && score % 3 === 0) || score === 50;
  }
  return score <= 60;
}

/** Group a trace into visits, per seat. */
function visitsOf(trace: readonly DartRecord[], seat: number): Dart[][] {
  const out: Dart[][] = [];
  let current: Dart[] = [];
  for (const rec of trace) {
    if (rec.seat !== seat) continue;
    if (rec.inVisit === 0 && current.length > 0) {
      out.push(current);
      current = [];
    }
    current.push(rec.dart);
  }
  if (current.length > 0) out.push(current);
  return out;
}

export function computeStats(games: readonly CompletedGame[], playerId: string): Stats {
  const s = { ...EMPTY } as { -readonly [K in keyof Stats]: Stats[K] };

  const numberHits = new Map<Wedge, number>();
  let firstNinePoints = 0;
  let firstNineDarts = 0;
  let x01Points = 0;
  let x01Darts = 0;
  let cricketMarks = 0;
  let cricketDarts = 0;

  for (const game of games) {
    const seat = game.players.findIndex((p) => p.id === playerId);
    if (seat === -1) continue;

    s.games++;
    if (game.winner === seat) s.wins++;

    const { trace } = reduce(game.config, game.players, game.log);
    const mine = trace.filter((r) => r.seat === seat);
    if (mine.length === 0) continue;

    // --- board-wide counts ---
    for (const rec of mine) {
      const d = rec.dart;
      s.darts++;
      if (points(d) > 0) s.hits++;

      switch (d.ring) {
        case "treble":
          s.trebles++;
          break;
        case "double":
          s.doubles++;
          break;
        case "single":
          s.singles++;
          break;
        case "innerBull":
          s.innerBulls++;
          break;
        case "outerBull":
          s.outerBulls++;
          break;
        case "miss":
          break;
      }
      if (isBed(d) && "wedge" in d) {
        numberHits.set(d.wedge, (numberHits.get(d.wedge) ?? 0) + 1);
      }
    }

    // --- per game kind ---
    if (game.config.kind === "x01") {
      x01Darts += mine.length;

      for (const rec of mine) {
        // A busted dart still scored on the board even though the visit was
        // wiped, so count what was thrown, not the net change.
        x01Points += points(rec.dart);

        if (isCheckoutAttempt(rec, game.config)) {
          s.checkoutAttempts++;
          if (rec.scoreAfter === 0) s.checkoutsHit++;
        }
      }

      // First nine: scoring power before the finish drags it down.
      for (const rec of mine.slice(0, 9)) {
        firstNinePoints += points(rec.dart);
        firstNineDarts++;
      }

      for (const visit of visitsOf(trace, seat)) {
        const scored = visit.reduce((sum, d) => sum + points(d), 0);
        if (scored > s.bestVisit) s.bestVisit = scored;
        if (scored === 180) s.maximums++;
        else if (scored >= 140) s.ton140s++;
        else if (scored >= 100) s.ton100s++;
        else if (scored >= 60) s.score60s++;
      }

      if (game.winner === seat) {
        // Best leg is darts used, so it's just how many of mine there were.
        if (s.bestLeg === null || mine.length < s.bestLeg) s.bestLeg = mine.length;
        // The score sitting there before the winning dart is the checkout.
        const winningDart = mine[mine.length - 1];
        const checkout = winningDart?.scoreBefore ?? 0;
        if (checkout > s.highCheckout) s.highCheckout = checkout;
      }
    }

    if (game.config.kind === "cricket") {
      cricketDarts += mine.length;
      for (const rec of mine) {
        // Marks only exist on the sheet. A treble seven is a wasted dart, not
        // three marks — it still counts against the average, but scores nothing.
        if (targetOf(rec.dart) !== null) cricketMarks += marks(rec.dart);
      }
    }

    // --- events tell us the rest ---
    for (const rec of mine) {
      for (const e of rec.events) {
        if (e.type === "shanghai" && e.seat === seat) s.shanghais++;
        if (e.type === "homeRun" && e.seat === seat) s.homeRuns++;
        if (e.type === "grandSlam" && e.seat === seat) s.grandSlams++;
        if (e.type === "lifeLost" && e.by === seat && e.seat !== seat) s.kills++;
        if (e.type === "inningEnded") s.innings++;
      }
    }

    if (game.config.kind === "baseball") {
      const { state } = reduce(game.config, game.players, game.log);
      s.runs += state.scores[seat] ?? 0;
    }

    // High score for the point-scoring games.
    if (game.config.kind !== "x01") {
      const { state } = reduce(game.config, game.players, game.log);
      const final = state.scores[seat] ?? 0;
      if (final > s.highScore) s.highScore = final;
    }
  }

  // --- derived ---
  s.winPercent = ratio(s.wins, s.games) * 100;
  s.hitPercent = ratio(s.hits, s.darts) * 100;
  s.ppd = ratio(x01Points, x01Darts);
  s.threeDartAverage = s.ppd * 3;
  s.firstNineAverage = ratio(firstNinePoints, firstNineDarts) * 3;
  s.checkoutPercent = ratio(s.checkoutsHit, s.checkoutAttempts) * 100;
  s.marks = cricketMarks;
  s.mpr = ratio(cricketMarks, cricketDarts) * 3;
  s.runsPerInning = ratio(s.runs, s.innings);
  s.rating = s.mpr * 10 + s.ppd;

  const ranked = [...numberHits.entries()].sort((a, b) => b[1] - a[1]);
  s.bestNumber = ranked[0]?.[0] ?? null;
  s.worstNumber = ranked[ranked.length - 1]?.[0] ?? null;

  return s;
}

/** The stat set for a single game — what the results screen shows. */
export const statsForGame = (game: CompletedGame, playerId: string): Stats =>
  computeStats([game], playerId);
