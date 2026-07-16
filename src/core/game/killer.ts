import type { Bed, Dart, Wedge } from "../board";
import type { ConfigOf, Player } from "./config";
import {
  type CommonState,
  type GameEngine,
  initCommon,
  type StepResult,
  THREE_DARTS,
} from "./engine";
import type { GameEvent } from "./events";
import type { GameView, KillerSeatView, PlayerView } from "./view";

/**
 * Killer — claim a number, earn the right to kill, then take everyone else out.
 *
 * Standard killer is played on doubles: hit your own double to become a killer,
 * hit someone else's to take a life, and hitting your own again as a killer
 * costs you one. `target: 'single'` relaxes that to plain numbers, which is how
 * the old app played it.
 *
 * `oneKiller` means only one player holds the status at a time — taking it
 * takes it away from whoever had it.
 */

export interface KillerState extends CommonState {
  readonly kind: "killer";
  readonly config: ConfigOf<"killer">;
  /** The number each seat owns, or null while still claiming. */
  readonly claimed: readonly (Wedge | null)[];
  readonly killers: readonly boolean[];
  readonly phase: "claim" | "kill";
}

const wedgeOf = (dart: Dart): Wedge | null => ("wedge" in dart ? dart.wedge : null);

/** Does this dart count as a strike on its number, under the configured rule? */
const strikes = (dart: Dart, rule: "double" | "single"): boolean =>
  rule === "double" ? dart.ring === "double" : dart.ring !== "miss";

const seatOwning = (s: KillerState, wedge: Wedge): number => s.claimed.indexOf(wedge);

const stillIn = (s: KillerState): number[] =>
  s.players.map((_, i) => i).filter((i) => s.active[i] === true);

export const killerEngine: GameEngine<ConfigOf<"killer">, KillerState> = {
  kind: "killer",
  // Killing is three darts like everything else; the claim phase ends its own
  // visit after a single number, via `endVisit`.
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): KillerState {
    return {
      ...initCommon(players, config.lives),
      kind: "killer",
      config,
      claimed: players.map(() => null),
      killers: players.map(() => false),
      phase: "claim",
    };
  },

  step(state, dart): StepResult<KillerState> {
    const seat = state.visit.seat;

    if (state.phase === "claim") return claim(state, seat, dart);
    return kill(state, seat, dart);
  },

  aim(state): Bed {
    const seat = state.visit.seat;
    const ring = state.config.target === "double" ? "double" : "treble";

    if (state.phase === "claim") {
      // Take the best number nobody owns yet.
      const free = ([20, 19, 18, 17, 16, 15, 14, 13, 12, 11] as Wedge[]).find(
        (w) => !state.claimed.includes(w),
      );
      return { ring: "single", wedge: free ?? 20 };
    }

    const mine = state.claimed[seat];

    // Not a killer yet: go earn it on your own number.
    if (state.killers[seat] !== true) {
      return { ring, wedge: mine ?? 20 };
    }

    // A killer: pick on whoever has the most lives left, to even things up.
    const targets = stillIn(state).filter((i) => i !== seat);
    const victim = targets.sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0))[0];
    const victimNumber = victim !== undefined ? state.claimed[victim] : null;
    return { ring, wedge: victimNumber ?? mine ?? 20 };
  },

  view(state): GameView {
    const seat = state.visit.seat;
    const players: PlayerView[] = state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: state.scores[i] ?? 0,
      isBot: p.sigma !== undefined,
      isActive: state.active[i] === true,
      isThrowing: i === seat && state.winner === null,
    }));

    const seats: KillerSeatView[] = state.players.map((_, i) => ({
      target: state.claimed[i] ?? null,
      lives: state.scores[i] ?? 0,
      isKiller: state.killers[i] === true,
    }));

    return {
      kind: "killer",
      players,
      visit: {
        seat,
        darts: state.visit.darts,
        points: 0,
        dartsLeft: 3 - state.visit.darts.length,
      },
      round: state.round,
      winner: state.winner,
      panel: { kind: "killer", phase: state.phase, seats },
    };
  },
};

/** Claim phase: one number each, first come first served. */
function claim(state: KillerState, seat: number, dart: Dart): StepResult<KillerState> {
  const wedge = wedgeOf(dart);

  // A miss, or somebody else's number — throw again.
  if (wedge === null || state.claimed.includes(wedge)) {
    return { state, events: [{ type: "dartMissed", seat, dart }] };
  }

  const claimed = state.claimed.map((c, i) => (i === seat ? wedge : c));
  const everyoneIn = claimed.every((c, i) => c !== null || state.active[i] !== true);

  return {
    state: { ...state, claimed, phase: everyoneIn ? "kill" : "claim" },
    events: [{ type: "numberClaimed", seat, target: wedge }],
    // One claim per visit, then it's the next player's turn to pick.
    endVisit: true,
  };
}

/** Kill phase: earn the status, then spend it on everyone else. */
function kill(state: KillerState, seat: number, dart: Dart): StepResult<KillerState> {
  const wedge = wedgeOf(dart);
  if (wedge === null || !strikes(dart, state.config.target)) {
    return { state, events: [{ type: "dartMissed", seat, dart }] };
  }

  const owner = seatOwning(state, wedge);
  if (owner === -1 || state.active[owner] !== true) {
    return { state, events: [{ type: "dartMissed", seat, dart }] };
  }

  const isKiller = state.killers[seat] === true;

  // --- your own number ---
  if (owner === seat) {
    if (!isKiller) {
      // Earn the status. In one-killer mode, you take it off whoever had it.
      const killers = state.players.map((_, i) =>
        state.config.oneKiller ? i === seat : i === seat || state.killers[i] === true,
      );
      const events: GameEvent[] = [{ type: "becameKiller", seat }];
      if (state.config.oneKiller) {
        const previous = state.killers.findIndex((k, i) => k && i !== seat);
        if (previous !== -1) events.push({ type: "lostKillerStatus", seat: previous });
      }
      return { state: { ...state, killers }, events };
    }

    // Standard rule: a killer hitting their own number pays for it.
    if (state.config.target === "double") {
      return takeLife(state, seat, seat, dart);
    }
    return { state, events: [{ type: "dartMissed", seat, dart }] };
  }

  // --- someone else's number ---
  if (!isKiller) {
    // Not a killer yet, so it does nothing.
    return { state, events: [{ type: "dartMissed", seat, dart }] };
  }
  return takeLife(state, seat, owner, dart);
}

function takeLife(
  state: KillerState,
  by: number,
  victim: number,
  _dart: Dart,
): StepResult<KillerState> {
  const livesLeft = Math.max(0, (state.scores[victim] ?? 0) - 1);
  const scores = state.scores.map((v, i) => (i === victim ? livesLeft : v));
  const out = livesLeft === 0;
  const active = state.active.map((a, i) => (i === victim && out ? false : a));
  // Dead players are nobody's killer.
  const killers = state.killers.map((k, i) => (i === victim && out ? false : k));

  const events: GameEvent[] = [{ type: "lifeLost", seat: victim, by, livesLeft }];
  if (out) events.push({ type: "eliminated", seat: victim });

  let next: KillerState = { ...state, scores, active, killers };

  const survivors = stillIn(next);
  if (survivors.length === 1) {
    const winner = survivors[0] as number;
    next = { ...next, winner };
    events.push({ type: "won", seat: winner });
  }

  return { state: next, events };
}
