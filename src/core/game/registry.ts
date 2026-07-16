import type { Bed, Dart } from "../board";
import { type AroundTheClockState, aroundTheClockEngine } from "./aroundTheClock";
import { type BaseballState, baseballEngine } from "./baseball";
import { type Bobs27State, bobs27Engine } from "./bobs27";
import type { GameConfig, GameKind, Player } from "./config";
import { type CricketState, cricketEngine } from "./cricket";
import { type DartRecord, type GameEngine, runLog } from "./engine";
import type { GameEvent } from "./events";
import { type HalveItState, halveItEngine } from "./halveIt";
import { type KillerState, killerEngine } from "./killer";
import { type ShanghaiState, shanghaiEngine } from "./shanghai";
import type { GameView } from "./view";
import { type X01State, x01Engine } from "./x01";

/**
 * The one place that knows every game exists.
 *
 * Everything above this line talks to `reduce` / `view` / `aim` and never names
 * a game. Everything below is a self-contained engine. Dispatch is a switch on
 * `config.kind`, which narrows the union for free — no generics gymnastics, no
 * casts, no registry-of-unknown.
 *
 * Adding a game touches this file and nothing else above it. The three added
 * after the first five needed no change to the contract at all, which is the
 * only real evidence the contract was right.
 */

export type GameState =
  | X01State
  | CricketState
  | ShanghaiState
  | BaseballState
  | KillerState
  | AroundTheClockState
  | HalveItState
  | Bobs27State;

export type StateOf<K extends GameKind> = Extract<GameState, { kind: K }>;

/**
 * Fold a log of darts into game state.
 *
 * This is the entire read path for a game in progress: the log is the truth,
 * everything else is derived. Undo is `reduce(config, players, log.slice(0, -1))`.
 *
 * Returns the events from the *last* dart — what just happened. Everything
 * earlier is already baked into the state.
 */
export function reduce(
  config: GameConfig,
  players: readonly Player[],
  log: readonly Dart[],
): { state: GameState; events: readonly GameEvent[]; trace: readonly DartRecord[] } {
  switch (config.kind) {
    case "x01":
      return runLog(x01Engine, config, players, log);
    case "cricket":
      return runLog(cricketEngine, config, players, log);
    case "shanghai":
      return runLog(shanghaiEngine, config, players, log);
    case "baseball":
      return runLog(baseballEngine, config, players, log);
    case "killer":
      return runLog(killerEngine, config, players, log);
    case "aroundTheClock":
      return runLog(aroundTheClockEngine, config, players, log);
    case "halveIt":
      return runLog(halveItEngine, config, players, log);
    case "bobs27":
      return runLog(bobs27Engine, config, players, log);
  }
}

/** The read model for any game. One screen can render all five off this. */
export function view(state: GameState): GameView {
  switch (state.kind) {
    case "x01":
      return x01Engine.view(state);
    case "cricket":
      return cricketEngine.view(state);
    case "shanghai":
      return shanghaiEngine.view(state);
    case "baseball":
      return baseballEngine.view(state);
    case "killer":
      return killerEngine.view(state);
    case "aroundTheClock":
      return aroundTheClockEngine.view(state);
    case "halveIt":
      return halveItEngine.view(state);
    case "bobs27":
      return bobs27Engine.view(state);
  }
}

/**
 * Where a bot should throw from here.
 *
 * Strategy lives in the engines, so `bot.ts` never learns a game exists — it
 * just takes the bed this returns and scatters around it.
 */
export function aim(state: GameState): Bed {
  switch (state.kind) {
    case "x01":
      return x01Engine.aim(state);
    case "cricket":
      return cricketEngine.aim(state);
    case "shanghai":
      return shanghaiEngine.aim(state);
    case "baseball":
      return baseballEngine.aim(state);
    case "killer":
      return killerEngine.aim(state);
    case "aroundTheClock":
      return aroundTheClockEngine.aim(state);
    case "halveIt":
      return halveItEngine.aim(state);
    case "bobs27":
      return bobs27Engine.aim(state);
  }
}

/** Start a game with no darts thrown. */
export const start = (config: GameConfig, players: readonly Player[]): GameState =>
  reduce(config, players, []).state;

/** Type-level check that every kind has an engine. */
type EngineFor<K extends GameKind> = GameEngine<Extract<GameConfig, { kind: K }>, StateOf<K>>;
const _exhaustive: { readonly [K in GameKind]: EngineFor<K> } = {
  x01: x01Engine,
  cricket: cricketEngine,
  shanghai: shanghaiEngine,
  baseball: baseballEngine,
  killer: killerEngine,
  aroundTheClock: aroundTheClockEngine,
  halveIt: halveItEngine,
  bobs27: bobs27Engine,
};
export const ENGINES = _exhaustive;
