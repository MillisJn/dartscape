import { type Bed, type Dart, isMiss, marks as marksOf } from "../board";
import type { ConfigOf, Player } from "./config";
import {
  type CommonState,
  type GameEngine,
  initCommon,
  type StepResult,
  THREE_DARTS,
} from "./engine";
import type { GameEvent, Target } from "./events";
import type { CricketRow, GameView, PlayerView } from "./view";

/**
 * Cricket — 15 through 20 and the bull. Three marks closes a number for you;
 * after that it scores points until everyone else has closed it too. Close
 * everything and lead, and you win.
 *
 * Variants: points (standard), cut-throat (your points go to everyone who
 * hasn't closed it, and lowest wins), and no-points (a pure race to close).
 */

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, "bull"] as const;
export type CricketTarget = (typeof CRICKET_TARGETS)[number];

const MARKS_TO_CLOSE = 3;

export interface CricketState extends CommonState {
  readonly kind: "cricket";
  readonly config: ConfigOf<"cricket">;
  /** `marks[seat][targetIndex]`, capped at 3. Overflow becomes points. */
  readonly marks: readonly (readonly number[])[];
}

/** Which cricket target this dart hit, or null if it's off-sheet. */
export function targetOf(dart: Dart): CricketTarget | null {
  if (dart.ring === "innerBull" || dart.ring === "outerBull") return "bull";
  if (dart.ring === "miss") return null;
  return (CRICKET_TARGETS as readonly (number | string)[]).includes(dart.wedge)
    ? (dart.wedge as CricketTarget)
    : null;
}

const indexOf = (t: CricketTarget): number => CRICKET_TARGETS.indexOf(t);
/** Points per mark. The bull is worth 25 whichever ring you find. */
const pointsPerMark = (t: CricketTarget): number => (t === "bull" ? 25 : t);

const hasClosed = (s: CricketState, seat: number, i: number): boolean =>
  (s.marks[seat]?.[i] ?? 0) >= MARKS_TO_CLOSE;

/** Anyone still able to be scored on for this target? */
const liveForOthers = (s: CricketState, seat: number, i: number): boolean =>
  s.players.some((_, o) => o !== seat && s.active[o] === true && !hasClosed(s, o, i));

const closedEverything = (s: CricketState, seat: number): boolean =>
  CRICKET_TARGETS.every((_, i) => hasClosed(s, seat, i));

const isDead = (s: CricketState, i: number): boolean =>
  s.players.every((_, o) => s.active[o] !== true || hasClosed(s, o, i));

function leads(s: CricketState, seat: number): boolean {
  const mine = s.scores[seat] ?? 0;
  const others = s.players
    .map((_, o) => o)
    .filter((o) => o !== seat && s.active[o] === true)
    .map((o) => s.scores[o] ?? 0);
  if (others.length === 0) return true;
  return s.config.scoring === "cutThroat"
    ? others.every((v) => mine <= v)
    : others.every((v) => mine >= v);
}

export const cricketEngine: GameEngine<ConfigOf<"cricket">, CricketState> = {
  kind: "cricket",
  visitPolicy: THREE_DARTS,

  init(config, players: readonly Player[]): CricketState {
    return {
      ...initCommon(players, 0),
      kind: "cricket",
      config,
      marks: players.map(() => CRICKET_TARGETS.map(() => 0)),
    };
  },

  step(state, dart): StepResult<CricketState> {
    const seat = state.visit.seat;
    const target = targetOf(dart);

    if (target === null || isMiss(dart)) {
      return { state, events: [{ type: "dartMissed", seat, dart }] };
    }

    const i = indexOf(target);
    const before = state.marks[seat]?.[i] ?? 0;
    const hit = marksOf(dart);
    const after = Math.min(MARKS_TO_CLOSE, before + hit);
    const overflow = before + hit - after;

    const events: GameEvent[] = [{ type: "marked", seat, target, marks: after - before }];

    const marks = state.marks.map((row, s) =>
      s === seat ? row.map((m, j) => (j === i ? after : m)) : row,
    );
    let next: CricketState = { ...state, marks };

    if (before < MARKS_TO_CLOSE && after === MARKS_TO_CLOSE) {
      events.push({ type: "targetClosed", seat, target });
      if (isDead(next, i)) events.push({ type: "targetDead", target });
    }

    // Overflow marks only score while somebody else still has the number open.
    const scoring = state.config.scoring !== "noPoints" && liveForOthers(next, seat, i);
    const points = scoring ? overflow * pointsPerMark(target) : 0;

    if (points > 0) {
      const scores =
        state.config.scoring === "cutThroat"
          ? // Cut-throat: the points land on everyone who hasn't closed it.
            next.scores.map((v, o) =>
              o !== seat && next.active[o] === true && !hasClosed(next, o, i) ? v + points : v,
            )
          : next.scores.map((v, o) => (o === seat ? v + points : v));
      next = { ...next, scores };
      events.push({ type: "dartScored", seat, dart, points });
    }

    if (closedEverything(next, seat) && leads(next, seat)) {
      next = { ...next, winner: seat };
      events.push({ type: "won", seat });
    }

    return { state: next, events };
  },

  aim(state): Bed {
    const seat = state.visit.seat;

    // Ahead: work on your own sheet. Behind: hit whatever still scores.
    const preferOwn = leads(state, seat);
    const wanted = CRICKET_TARGETS.find((_target, i) =>
      preferOwn
        ? !hasClosed(state, seat, i)
        : !hasClosed(state, seat, i) || liveForOthers(state, seat, i),
    );

    const target = wanted ?? 20;
    if (target === "bull") return { ring: "innerBull" };
    return { ring: "treble", wedge: target };
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

    const rows: CricketRow[] = CRICKET_TARGETS.map((target, i) => ({
      target: target as Target,
      marks: state.players.map((_, s) => state.marks[s]?.[i] ?? 0),
      dead: isDead(state, i),
    }));

    return {
      kind: "cricket",
      players,
      visit: {
        seat,
        darts: state.visit.darts,
        points: 0,
        dartsLeft: 3 - state.visit.darts.length,
      },
      round: state.round,
      winner: state.winner,
      panel: { kind: "cricket", rows },
    };
  },
};
