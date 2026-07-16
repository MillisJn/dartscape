/**
 * The core, driven end to end with no UI and no device.
 *
 *   npm run sim              a full 501 double-out match, bot vs bot
 *   npm run sim -- --curve   the skill curve: PPD and 3-dart average per tier
 *   npm run sim -- --games   one game of each kind, played to a winner
 *
 * This is the real proof the data side works: if a match plays out here and the
 * numbers look like darts, the engines, the bot, the match rules and the stats
 * all agree with each other.
 */

import { type Bed, bed, type Dart, label, points, SIGMA_T19_CROSSOVER } from '../src/core/board';
import { measurePpd, type Rng, seeded, SKILL, SKILL_NAMES, throwAt } from '../src/core/bot/bot';
import { DEFAULT_CONFIG, GAME_KINDS, type GameConfig, type Player } from '../src/core/game/config';
import { aim, reduce } from '../src/core/game/registry';
import {
  describeFormat,
  type LegResult,
  type MatchFormat,
  matchState,
} from '../src/core/match/match';
import { type CompletedGame, computeStats } from '../src/core/stats/stats';

const T20: Bed = bed('treble', 20);
const T19: Bed = bed('treble', 19);

// ---------------------------------------------------------------------------

function curve(): void {
  console.log('\nSKILL CURVE — best target, 40k darts per tier\n');
  console.log('tier      | sigma |   PPD | 3-dart avg | aims at');
  console.log('----------+-------+-------+------------+--------');

  for (const name of SKILL_NAMES) {
    const sigma = SKILL[name];
    const t20 = measurePpd(T20, sigma, seeded(1), 40_000, points);
    const t19 = measurePpd(T19, sigma, seeded(1), 40_000, points);
    const best = Math.max(t19, t20);
    console.log(
      `${name.padEnd(9)} | ${String(sigma).padStart(5)} | ${best.toFixed(2).padStart(5)} | ` +
        `${(best * 3).toFixed(1).padStart(10)} | ${t19 > t20 ? 'T19' : 'T20'}`,
    );
  }

  console.log(`\nT19 vs T20 — the board says the crossover is ${SIGMA_T19_CROSSOVER}mm\n`);
  console.log('sigma | T20 avg | T19 avg | better');
  console.log('------+---------+---------+-------');
  for (const sigma of [5, 10, 13, 15, 17, 19, 21, 25, 30, 40, 50, 65]) {
    const t20 = measurePpd(T20, sigma, seeded(1), 40_000, points) * 3;
    const t19 = measurePpd(T19, sigma, seeded(1), 40_000, points) * 3;
    console.log(
      `${String(sigma).padStart(5)} | ${t20.toFixed(1).padStart(7)} | ` +
        `${t19.toFixed(1).padStart(7)} | ${t19 > t20 ? 'T19' : 'T20'}`,
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------

interface PlayedGame {
  readonly log: Dart[];
  readonly winner: number;
  readonly visits: string[];
}

/** Play one game to a winner, bots throwing for everybody. */
function playGame(config: GameConfig, players: readonly Player[], rng: Rng): PlayedGame {
  const log: Dart[] = [];
  const visits: string[] = [];
  let current: Dart[] = [];
  let guard = 0;

  for (;;) {
    const { state } = reduce(config, players, log);
    if (state.winner !== null) return { log, winner: state.winner, visits };
    if (guard++ > 5000) throw new Error(`${config.kind} never finished`);

    const seat = state.visit.seat;
    const sigma = players[seat]?.sigma ?? 20;
    const dart = throwAt(aim(state), sigma, rng);
    log.push(dart);
    current.push(dart);

    const after = reduce(config, players, log);
    if (after.state.visit.seat !== seat || after.state.winner !== null) {
      const scored = current.reduce((s, d) => s + points(d), 0);
      visits.push(
        `${(players[seat]?.name ?? '?').padEnd(8)} ${current
          .map(label)
          .join(' ')
          .padEnd(15)} ${String(scored).padStart(3)}  ->  ${after.state.scores[seat]}`,
      );
      current = [];
    }
  }
}

const asCompleted = (
  id: string,
  config: GameConfig,
  players: readonly Player[],
  played: PlayedGame,
): CompletedGame => ({
  id,
  config,
  players,
  log: played.log,
  winner: played.winner,
  playedAt: Date.now(),
});

// ---------------------------------------------------------------------------

function match(): void {
  const players: readonly Player[] = [
    { id: 'p1', name: 'MASTER', sigma: SKILL.MASTER },
    { id: 'p2', name: 'HARD', sigma: SKILL.HARD },
  ];
  const config: GameConfig = { kind: 'x01', start: 501, in: 'straight', out: 'double' };
  const format: MatchFormat = { kind: 'legRace', legs: 3 };
  const ids = players.map((p) => p.id);
  const rng = seeded(2026);

  console.log(`\n501 DOUBLE OUT — ${describeFormat(format)}`);
  console.log(`${players.map((p) => `${p.name} (sigma ${p.sigma})`).join('  vs  ')}\n`);

  const results: LegResult[] = [];
  const games: CompletedGame[] = [];

  while (matchState(format, ids, results).winner === null) {
    const played = playGame(config, players, rng);
    const game = asCompleted(`leg${games.length + 1}`, config, players, played);
    games.push(game);
    results.push({ winner: players[played.winner]?.id as string });

    const winnerDarts = played.log.filter(
      (_, i) => reduce(config, players, played.log.slice(0, i)).state.visit.seat === played.winner,
    ).length;

    console.log(`--- LEG ${games.length} ---`);
    for (const v of played.visits) console.log(`  ${v}`);
    console.log(`  ${players[played.winner]?.name} wins it in ${winnerDarts} darts\n`);
  }

  const final = matchState(format, ids, results);
  const champ = players.find((p) => p.id === final.winner);

  console.log('==================================================');
  console.log(`MATCH: ${champ?.name}    (${ids.map((id) => `${id}:${final.legs[id]}`).join('  ')})`);
  console.log('==================================================\n');

  console.log('player   | legs | 3-dart | first 9 | checkout % | best leg | 180s | high out');
  console.log('---------+------+--------+---------+------------+----------+------+---------');
  for (const p of players) {
    const s = computeStats(games, p.id);
    console.log(
      `${p.name.padEnd(8)} | ${String(s.wins).padStart(4)} | ` +
        `${s.threeDartAverage.toFixed(2).padStart(6)} | ` +
        `${s.firstNineAverage.toFixed(2).padStart(7)} | ` +
        `${`${s.checkoutPercent.toFixed(1)}% (${s.checkoutsHit}/${s.checkoutAttempts})`.padStart(10)} | ` +
        `${String(s.bestLeg ?? '-').padStart(8)} | ` +
        `${String(s.maximums).padStart(4)} | ${String(s.highCheckout).padStart(8)}`,
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------

/** One game of every kind, played to a winner. Proves every engine terminates. */
function allGames(): void {
  const players: readonly Player[] = [
    { id: 'p1', name: 'HARDER', sigma: SKILL.HARDER },
    { id: 'p2', name: 'MEDIUM', sigma: SKILL.MEDIUM },
  ];
  const rng = seeded(7);
  const width = Math.max(4, ...GAME_KINDS.map((k) => k.length));

  console.log('\nONE GAME OF EACH — every engine, played to a winner\n');
  console.log(`${'game'.padEnd(width)} | darts | winner | final scores`);
  console.log(`${'-'.repeat(width)}-+-------+--------+-------------`);

  for (const kind of GAME_KINDS) {
    const config = DEFAULT_CONFIG[kind];
    const played = playGame(config, players, rng);
    const { state } = reduce(config, players, played.log);
    console.log(
      `${kind.padEnd(width)} | ${String(played.log.length).padStart(5)} | ` +
        `${(players[played.winner]?.name ?? '?').padEnd(6)} | ${state.scores.join(' - ')}`,
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------

/**
 * Round robin: every skill tier against every other, at 501. If the model is
 * any good the leaderboard should sort itself into the skill order without
 * being told.
 */
function tournament(): void {
  const tiers = SKILL_NAMES;
  const config: GameConfig = { kind: 'x01', start: 501, in: 'straight', out: 'double' };
  const rng = seeded(4242);
  const LEGS = 12;

  const wins = new Map<string, number>(tiers.map((t) => [t, 0]));
  const played = new Map<string, number>(tiers.map((t) => [t, 0]));
  const allGames: CompletedGame[] = [];

  console.log(`\nROUND ROBIN — every tier vs every tier, ${LEGS} legs each\n`);

  for (let i = 0; i < tiers.length; i++) {
    for (let j = i + 1; j < tiers.length; j++) {
      const a = tiers[i] as string;
      const b = tiers[j] as string;
      const players: readonly Player[] = [
        { id: a, name: a, sigma: SKILL[a as keyof typeof SKILL] },
        { id: b, name: b, sigma: SKILL[b as keyof typeof SKILL] },
      ];

      for (let leg = 0; leg < LEGS; leg++) {
        const p = playGame(config, players, rng);
        const winner = players[p.winner]?.id as string;
        wins.set(winner, (wins.get(winner) ?? 0) + 1);
        played.set(a, (played.get(a) ?? 0) + 1);
        played.set(b, (played.get(b) ?? 0) + 1);
        allGames.push(asCompleted(`t${allGames.length}`, config, players, p));
      }
    }
  }

  const table = tiers
    .map((t) => {
      const s = computeStats(
        allGames.filter((g) => g.players.some((p) => p.id === t)),
        t,
      );
      const w = wins.get(t) ?? 0;
      const n = played.get(t) ?? 1;
      return { tier: t, sigma: SKILL[t], wins: w, played: n, rate: (w / n) * 100, s };
    })
    .sort((x, y) => y.rate - x.rate);

  console.log('tier      | sigma | win % | 3-dart | first 9 | checkout % | best leg | 180s');
  console.log('----------+-------+-------+--------+---------+------------+----------+-----');
  for (const r of table) {
    console.log(
      `${r.tier.padEnd(9)} | ${String(r.sigma).padStart(5)} | ` +
        `${r.rate.toFixed(1).padStart(5)} | ${r.s.threeDartAverage.toFixed(2).padStart(6)} | ` +
        `${r.s.firstNineAverage.toFixed(2).padStart(7)} | ` +
        `${r.s.checkoutPercent.toFixed(1).padStart(9)}% | ` +
        `${String(r.s.bestLeg ?? '-').padStart(8)} | ${String(r.s.maximums).padStart(4)}`,
    );
  }

  const ordered = table.map((r) => r.tier);
  const expected = [...SKILL_NAMES].reverse();
  console.log(
    `\nLeaderboard order ${
      ordered.join() === expected.join() ? 'MATCHES' : 'DIFFERS FROM'
    } the skill ladder.`,
  );
  console.log(`  by win rate: ${ordered.join(' > ')}`);
  console.log(`  by sigma:    ${expected.join(' > ')}\n`);
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes('--curve')) curve();
else if (args.includes('--games')) allGames();
else if (args.includes('--tournament')) tournament();
else match();
