import { describe, expect, it } from "vitest";
import { SKILL, seeded, throwAt } from "@/core/bot/bot";
import { DEFAULT_CONFIG, type Player } from "@/core/game/config";
import { aim, reduce } from "@/core/game/registry";

import { useMatchStore } from "./matchStore";
import { selectMatchState, selectView } from "./selectors";

const human: Player = { id: "human", name: "Ava", sigma: SKILL.HARD };
const hardBot: Player = { id: "bot", name: "Hard Bot", sigma: SKILL.MEDIUM };

/** A dart for whoever's throwing right now, via the same aim -> throwAt path the bot uses — this
 * is what proves a leg plays through the real store with the real reducer, no device required. */
function dartFor(rng: ReturnType<typeof seeded>) {
  const state = useMatchStore.getState();
  if (!state.config) throw new Error("no match in progress");
  const engineState = reduce(state.config, state.players, state.log).state;
  const seat = engineState.visit.seat;
  const player = state.players[seat];
  if (!player) throw new Error(`no player at seat ${seat}`);
  return throwAt(aim(engineState), player.sigma ?? SKILL.MEDIUM, rng);
}

describe("matchStore", () => {
  it("throwDart appends to the log", () => {
    useMatchStore.getState().reset();
    useMatchStore.getState().start(DEFAULT_CONFIG.x01, [human, hardBot]);
    useMatchStore.getState().throwDart({ ring: "single", wedge: 20 });
    expect(useMatchStore.getState().log).toEqual([{ ring: "single", wedge: 20 }]);
  });

  it("undo pops one dart", () => {
    useMatchStore.getState().reset();
    useMatchStore.getState().start(DEFAULT_CONFIG.x01, [human, hardBot]);
    useMatchStore.getState().throwDart({ ring: "single", wedge: 20 });
    useMatchStore.getState().throwDart({ ring: "single", wedge: 5 });
    useMatchStore.getState().undo();
    expect(useMatchStore.getState().log).toEqual([{ ring: "single", wedge: 20 }]);
  });

  it("upgrade pops the previous dart and pushes the replacement, in one op", () => {
    useMatchStore.getState().reset();
    useMatchStore.getState().start(DEFAULT_CONFIG.x01, [human, hardBot]);
    useMatchStore.getState().throwDart({ ring: "single", wedge: 20 });
    useMatchStore.getState().upgrade({ ring: "double", wedge: 20 });
    expect(useMatchStore.getState().log).toEqual([{ ring: "double", wedge: 20 }]);
  });

  it("a bot dart and a human dart take the exact same path (throwDart)", () => {
    useMatchStore.getState().reset();
    useMatchStore.getState().start(DEFAULT_CONFIG.x01, [human, hardBot]);
    // A "human" dart is just whatever throwDart is given — the store can't tell the difference,
    // which is the whole point (see core/PLAN.md: "A bot dart and a human dart are
    // indistinguishable to the core.").
    useMatchStore.getState().throwDart({ ring: "treble", wedge: 20 });
    useMatchStore.getState().throwDart({ ring: "single", wedge: 5 });
    expect(useMatchStore.getState().log).toHaveLength(2);
  });

  it("plays a full 501 leg through the store — no device, no render", () => {
    useMatchStore.getState().reset();
    useMatchStore.getState().start(DEFAULT_CONFIG.x01, [human, hardBot]);
    const rng = seeded(42);

    let guard = 0;
    while (selectView(useMatchStore.getState())?.winner == null) {
      if (++guard > 500) throw new Error("leg never finished — something is wrong upstream");
      useMatchStore.getState().throwDart(dartFor(rng));
    }

    const finalView = selectView(useMatchStore.getState());
    expect(finalView?.winner).not.toBeNull();

    // Record the leg and prove the match layer (rank above the store) reads it back correctly.
    const winnerSeat = finalView?.winner as number;
    const winnerId = useMatchStore.getState().players[winnerSeat]?.id as string;
    useMatchStore.getState().recordLegResult(winnerId);
    expect(selectMatchState(useMatchStore.getState()).winner).toBe(winnerId);
  });

  it("startNextLeg keeps config, resets the log, and can reseat players", () => {
    useMatchStore.getState().reset();
    useMatchStore.getState().start(DEFAULT_CONFIG.x01, [human, hardBot]);
    useMatchStore.getState().throwDart({ ring: "single", wedge: 20 });
    useMatchStore.getState().startNextLeg([hardBot, human]);

    const state = useMatchStore.getState();
    expect(state.log).toEqual([]);
    expect(state.players.map((p) => p.id)).toEqual(["bot", "human"]);
    expect(state.config).toEqual(DEFAULT_CONFIG.x01);
  });
});
