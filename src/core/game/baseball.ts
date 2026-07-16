import type { Bed, Dart, Wedge } from "../board";
import type { ConfigOf, Player } from "./config";
import {
  type CommonState,
  type GameEngine,
  initCommon,
  type StepResult,
  type VisitPolicy,
} from "./engine";
import type { GameEvent } from "./events";
import type { GameView, PlayerView } from "./view";

/**
 * Baseball — the round is the inning, and the inning is the number you throw at.
 *
 * This is Dartscape's own take rather than the plain runs-per-inning version:
 * the multiplier is *bases advanced*, runners move round a diamond, and the bull
 * is a home run. Bases loaded plus a home run is a grand slam. Three outs end
 * your at-bat, so a visit here is not three darts — hence the engine's own visit
 * policy.
 */

const BASES = 4;
const OUTS_PER_AT_BAT = 3;
/** Index 0 is the batter; 1-3 are first, second and third. */
const EMPTY_BASES: readonly boolean[] = [false, false, false, false];

export interface BaseballState extends CommonState {
  readonly kind: "baseball";
  readonly config: ConfigOf<"baseball">;
  readonly outs: number;
  readonly bases: readonly boolean[];
  /** Runs and base hits for the at-bat in progress. */
  readonly runsThisAtBat: number;
  readonly hitsThisAtBat: number;
}

export const inningOf = (s: BaseballState): number => s.round + 1;

/** How many bases this dart is worth. 0 is an out. */
export function basesOf(dart: Dart, inning: number): number {
  // Any bull is a home run — which is why it's worth going for with the bases
  // loaded, and why the bot does exactly that.
  if (dart.ring === "innerBull" || dart.ring === "outerBull") return BASES;
  if (dart.ring === "miss") return 0;
  if (dart.wedge !== inning) return 0;
  return dart.ring === "single" ? 1 : dart.ring === "double" ? 2 : 3;
}

/** Advance the batter and everyone on base. Anyone past home scores. */
export function advance(
  bases: readonly boolean[],
  by: number,
): { bases: readonly boolean[]; runs: number } {
  const occupied = [true, ...bases.slice(1)]; // the batter is always up
  const next = [false, false, false, false];
  let runs = 0;

  for (let base = 0; base < BASES; base++) {
    if (occupied[base] !== true) continue;
    const to = base + by;
    if (to >= BASES) runs++;
    else next[to] = true;
  }

  return { bases: next, runs };
}

export const basesLoaded = (bases: readonly boolean[]): boolean =>
  bases[1] === true && bases[2] === true && bases[3] === true;

const lastActiveSeat = (s: CommonState): number => {
  for (let i = s.players.length - 1; i >= 0; i--) if (s.active[i] === true) return i;
  return 0;
};

/** Most runs takes it; a tie goes to whoever got there first. */
function bestSeat(s: BaseballState): number {
  let best = 0;
  for (let i = 1; i < s.players.length; i++) {
    if (s.active[i] === true && (s.scores[i] ?? 0) > (s.scores[best] ?? 0)) best = i;
  }
  return best;
}

const ENGINE_DECIDES: VisitPolicy = { kind: "engine" };

export const baseballEngine: GameEngine<ConfigOf<"baseball">, BaseballState> = {
  kind: "baseball",
  visitPolicy: ENGINE_DECIDES,

  init(config, players: readonly Player[]): BaseballState {
    return {
      ...initCommon(players, 0),
      kind: "baseball",
      config,
      outs: 0,
      bases: EMPTY_BASES,
      runsThisAtBat: 0,
      hitsThisAtBat: 0,
    };
  },

  step(state, dart): StepResult<BaseballState> {
    const seat = state.visit.seat;
    const inning = inningOf(state);
    const bases = basesOf(dart, inning);

    // --- an out ---
    if (bases === 0) {
      const outs = state.outs + 1;
      const atBatOver = outs >= OUTS_PER_AT_BAT;
      const events: GameEvent[] = [{ type: "out", seat, outs }];

      if (!atBatOver) {
        return { state: { ...state, outs }, events };
      }

      events.push({ type: "inningEnded", inning });
      const cleared: BaseballState = {
        ...state,
        outs: 0,
        bases: EMPTY_BASES,
        runsThisAtBat: 0,
        hitsThisAtBat: 0,
      };

      // The last batter of the last inning has just been retired.
      if (inning >= state.config.innings && seat === lastActiveSeat(state)) {
        const winner = bestSeat(cleared);
        return {
          state: { ...cleared, winner },
          events: [...events, { type: "won", seat: winner }],
        };
      }

      return { state: cleared, events, endVisit: true };
    }

    // --- a hit ---
    const loaded = basesLoaded(state.bases);
    const moved = advance(state.bases, bases);
    const events: GameEvent[] = [];

    if (bases >= BASES) {
      events.push({ type: "homeRun", seat, runs: moved.runs });
      if (loaded && moved.runs === BASES) events.push({ type: "grandSlam", seat });
    } else {
      events.push({ type: "baseHit", seat, bases, runs: moved.runs });
    }

    if (moved.runs > 0) {
      events.push({ type: "dartScored", seat, dart, points: moved.runs });
    }

    return {
      state: {
        ...state,
        bases: moved.bases,
        scores: state.scores.map((v, i) => (i === seat ? v + moved.runs : v)),
        runsThisAtBat: state.runsThisAtBat + moved.runs,
        hitsThisAtBat: state.hitsThisAtBat + 1,
      },
      events,
    };
  },

  aim(state): Bed {
    // Bases loaded: clear them. The bull brings everybody home.
    if (basesLoaded(state.bases)) return { ring: "innerBull" };
    return { ring: "treble", wedge: inningOf(state) as Wedge };
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

    return {
      kind: "baseball",
      players,
      visit: {
        seat,
        darts: state.visit.darts,
        points: state.runsThisAtBat,
        dartsLeft: OUTS_PER_AT_BAT - state.outs,
      },
      round: state.round,
      winner: state.winner,
      panel: {
        kind: "baseball",
        inning: inningOf(state),
        innings: state.config.innings,
        outs: state.outs,
        bases: state.bases,
        runs: state.runsThisAtBat,
        baseHits: state.hitsThisAtBat,
      },
    };
  },
};
