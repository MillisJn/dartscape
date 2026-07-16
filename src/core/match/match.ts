/**
 * Match structure — legs, sets, and who throws first next time.
 *
 * The old app tangled this into `GameData.setWinner()`, which mutated player win
 * counts as a side effect of recording a game winner, then read them back to
 * decide whether a set had been won. Here a match is just the list of legs
 * played plus a rule, and everything is derived from it — the same fold that
 * runs a game runs a match.
 */

export type MatchFormat =
  | { readonly kind: "single" }
  /** First to N legs takes the match. */
  | { readonly kind: "legRace"; readonly legs: number }
  /** Best-of-`legs` wins a set; best-of-`sets` wins the match. */
  | { readonly kind: "setMatch"; readonly legs: number; readonly sets: number };

/** One finished leg: who won it. Player ids, not seats — seats move between legs. */
export interface LegResult {
  readonly winner: string;
}

export interface MatchState {
  readonly format: MatchFormat;
  readonly players: readonly string[];
  /** Legs won in the set currently in progress. */
  readonly legs: Readonly<Record<string, number>>;
  readonly sets: Readonly<Record<string, number>>;
  readonly winner: string | null;
}

/** A majority of n. Best-of-3 is 2, best-of-5 is 3. */
export const majority = (n: number): number => Math.floor(n / 2) + 1;

export function legsToWinSet(format: MatchFormat): number {
  switch (format.kind) {
    case "single":
      return 1;
    case "legRace":
      return format.legs;
    case "setMatch":
      return majority(format.legs);
  }
}

export function setsToWinMatch(format: MatchFormat): number {
  return format.kind === "setMatch" ? majority(format.sets) : 1;
}

const zeroed = (players: readonly string[]): Record<string, number> =>
  Object.fromEntries(players.map((p) => [p, 0]));

/**
 * Fold finished legs into match state. Same shape as `reduce` for games: the
 * list is the truth, everything else is derived, and undo is a shorter list.
 */
export function matchState(
  format: MatchFormat,
  players: readonly string[],
  results: readonly LegResult[],
): MatchState {
  let legs = zeroed(players);
  const sets = zeroed(players);
  let winner: string | null = null;

  const needLegs = legsToWinSet(format);
  const needSets = setsToWinMatch(format);

  for (const { winner: legWinner } of results) {
    if (winner !== null) break;
    legs[legWinner] = (legs[legWinner] ?? 0) + 1;

    if ((legs[legWinner] ?? 0) < needLegs) continue;

    // Took the set (or, outside a set match, the whole thing).
    if (format.kind !== "setMatch") {
      winner = legWinner;
      continue;
    }

    sets[legWinner] = (sets[legWinner] ?? 0) + 1;
    legs = zeroed(players);
    if ((sets[legWinner] ?? 0) >= needSets) winner = legWinner;
  }

  return { format, players, legs, sets, winner };
}

export const isMatchOver = (m: MatchState): boolean => m.winner !== null;

/** e.g. "BEST OF 5 LEGS - 3 SETS", or "" for a one-off. */
export function describeFormat(format: MatchFormat): string {
  switch (format.kind) {
    case "single":
      return "";
    case "legRace":
      return `RACE TO ${format.legs} ${format.legs === 1 ? "LEG" : "LEGS"}`;
    case "setMatch":
      return `BEST OF ${format.legs} LEGS - ${format.sets} ${format.sets === 1 ? "SET" : "SETS"}`;
  }
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

/**
 * Who throws first in the next leg. A real Dartscape feature, and a pure
 * function of the last leg's result — which is why it lives out here rather
 * than inside game data as it does today.
 */
export type SeatingRule =
  | "unchanged"
  | "winnerFirst"
  | "loserFirst"
  | "bestToWorst"
  | "worstToBest"
  | "flip";

/** Rotate `players` so that `first` leads, keeping everyone's relative order. */
function rotateTo(players: readonly string[], first: string): readonly string[] {
  const at = players.indexOf(first);
  if (at <= 0) return players;
  return [...players.slice(at), ...players.slice(0, at)];
}

/**
 * @param seating  current order
 * @param ranking  last leg's finishing order, best first
 */
export function nextSeating(
  rule: SeatingRule,
  seating: readonly string[],
  ranking: readonly string[],
): readonly string[] {
  if (ranking.length === 0) return seating;
  const best = ranking[0] as string;
  const worst = ranking[ranking.length - 1] as string;

  switch (rule) {
    case "unchanged":
      return seating;
    case "winnerFirst":
      return rotateTo(seating, best);
    case "loserFirst":
      return rotateTo(seating, worst);
    case "bestToWorst":
      return ranking;
    case "worstToBest":
      return [...ranking].reverse();
    case "flip":
      return [...seating].reverse();
  }
}
