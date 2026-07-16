import { describe, expect, it } from "vitest";
import { SKILL, seeded, throwAt } from "@/core/bot/bot";
import { DEFAULT_CONFIG, GAME_KINDS, type Player } from "@/core/game/config";
import { aim, reduce } from "@/core/game/registry";

import { useMatchStore } from "./matchStore";
import { selectView } from "./selectors";

const players: readonly Player[] = [
  { id: "a", name: "A", sigma: SKILL.HARD },
  { id: "b", name: "B", sigma: SKILL.MEDIUM },
];

const DART_BUDGET = 4000;

/**
 * Step 7's "add a matchStore test that plays it to a winner through the store", for all eight
 * games at once. core/soak.test.ts already proves every engine terminates; this proves OUR
 * store's throwDart path (not a raw log array) drives every one of them the same way — the same
 * aim -> throwAt -> throwDart chain a finger takes for X01 (see matchStore.test.ts).
 */
describe("every game plays to a winner through the store", () => {
  for (const kind of GAME_KINDS) {
    it(`${kind}`, () => {
      useMatchStore.getState().reset();
      useMatchStore.getState().start(DEFAULT_CONFIG[kind], players);
      const rng = seeded(7);

      let darts = 0;
      while (selectView(useMatchStore.getState())?.winner == null) {
        if (++darts > DART_BUDGET) {
          throw new Error(`${kind} never finished through the store — something is wrong upstream`);
        }
        const state = useMatchStore.getState();
        if (!state.config) throw new Error("no config");
        const engineState = reduce(state.config, state.players, state.log).state;
        const seat = engineState.visit.seat;
        const player = state.players[seat];
        if (!player) throw new Error(`no player at seat ${seat}`);
        state.throwDart(throwAt(aim(engineState), player.sigma ?? SKILL.MEDIUM, rng));
      }

      expect(selectView(useMatchStore.getState())?.winner).not.toBeNull();
    });
  }
});
