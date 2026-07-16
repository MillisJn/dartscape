import { useEffect } from "react";

import type { Dart } from "@/core/board";
import { throwAt } from "@/core/bot/bot";
import type { GameConfig, Player } from "@/core/game/config";
import { aim, reduce } from "@/core/game/registry";

/**
 * Bot scheduling — the old app's Handler, as a Phase 2 timer. `reduce -> aim -> throwAt ->
 * onDart` is the exact same path a finger takes (onDart is matchStore.throwDart); the store
 * cannot tell a bot dart from a human one, which is what stops the bot metastasising into the
 * core the way the old GameBot/Handler/GameLogic triangle did.
 */
export function useBotTurn(
  config: GameConfig | null,
  players: readonly Player[],
  log: readonly Dart[],
  onDart: (dart: Dart) => void,
  delayMs = 700,
): void {
  useEffect(() => {
    if (!config) return;
    const state = reduce(config, players, log).state;
    if (state.winner !== null) return;

    const current = players[state.visit.seat];
    if (!current || current.sigma === undefined) return; // a human's turn

    const timer = setTimeout(() => {
      onDart(throwAt(aim(state), current.sigma as number, Math.random));
    }, delayMs);

    return () => clearTimeout(timer);
  }, [config, players, log, onDart, delayMs]);
}
