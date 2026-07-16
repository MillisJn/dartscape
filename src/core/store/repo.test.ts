import { beforeEach, describe, expect, it } from "vitest";
import { ALL_BEDS, bed, type Dart, INNER_BULL, MISS, OUTER_BULL } from "../board";
import type { GameConfig } from "../game/config";
import { computeStats } from "../stats/stats";
import {
  configFromJson,
  configToJson,
  dartToRow,
  memoryRepo,
  type Repo,
  rowToDart,
  type SavedGame,
} from "./repo";

const X01: GameConfig = { kind: "x01", start: 501, in: "straight", out: "double" };

describe("dart serialisation", () => {
  it("round-trips every bed on the board", () => {
    for (const b of ALL_BEDS) {
      expect(rowToDart(dartToRow(b))).toEqual(b);
    }
  });

  it("round-trips a miss", () => {
    expect(rowToDart(dartToRow(MISS))).toEqual(MISS);
  });

  it("round-trips both bulls", () => {
    expect(rowToDart(dartToRow(INNER_BULL))).toEqual(INNER_BULL);
    expect(rowToDart(dartToRow(OUTER_BULL))).toEqual(OUTER_BULL);
  });

  it("stores the bulls and misses with no wedge", () => {
    expect(dartToRow(INNER_BULL)).toEqual({ ring: "innerBull", wedge: null });
    expect(dartToRow(MISS)).toEqual({ ring: "miss", wedge: null });
    expect(dartToRow(bed("treble", 20))).toEqual({ ring: "treble", wedge: 20 });
  });

  it("refuses a wedge-less single", () => {
    expect(() => rowToDart({ ring: "single", wedge: null })).toThrow(/no wedge/);
  });

  it("refuses a ring it does not know", () => {
    expect(() => rowToDart({ ring: "quadruple", wedge: 20 })).toThrow(/unknown ring/);
  });
});

describe("config serialisation", () => {
  it("round-trips every game kind", () => {
    const configs: GameConfig[] = [
      X01,
      { kind: "cricket", scoring: "cutThroat" },
      { kind: "shanghai", from: 1, to: 7 },
      { kind: "baseball", innings: 9 },
      { kind: "killer", lives: 3, target: "double", oneKiller: true },
    ];
    for (const c of configs) {
      expect(configFromJson(configToJson(c))).toEqual(c);
    }
  });
});

describe("memoryRepo", () => {
  let repo: Repo;

  beforeEach(async () => {
    repo = memoryRepo();
    await repo.init();
  });

  describe("players", () => {
    it("creates and lists", async () => {
      await repo.createPlayer("Ava");
      await repo.createPlayer("Ben");
      expect((await repo.allPlayers()).map((p) => p.name)).toEqual(["Ava", "Ben"]);
    });

    it("refuses a duplicate name", async () => {
      await repo.createPlayer("Ava");
      await expect(repo.createPlayer("Ava")).rejects.toThrow(/already exists/);
    });

    it("renames", async () => {
      const p = await repo.createPlayer("Ava");
      await repo.renamePlayer(p.id, "Ava B");
      expect((await repo.allPlayers())[0]?.name).toBe("Ava B");
    });

    it("refuses to rename onto an unknown id", async () => {
      await expect(repo.renamePlayer("no-such-id", "Ava B")).rejects.toThrow(/no such player/);
    });

    it("refuses to rename onto another player's name", async () => {
      await repo.createPlayer("Ava");
      const ben = await repo.createPlayer("Ben");
      await expect(repo.renamePlayer(ben.id, "Ava")).rejects.toThrow(/already exists/);
    });

    it("deletes", async () => {
      const p = await repo.createPlayer("Ava");
      await repo.deletePlayer(p.id);
      expect(await repo.allPlayers()).toEqual([]);
    });
  });

  describe("games", () => {
    const gameFor = (id: string, playerId: string, log: Dart[], at = 1): SavedGame => ({
      id,
      config: X01,
      players: [{ id: playerId, name: "Ava" }],
      log,
      winner: null,
      playedAt: at,
      format: null,
    });

    it("saves and reads back", async () => {
      const p = await repo.createPlayer("Ava");
      const g = gameFor("g1", p.id, [bed("treble", 20)]);
      await repo.saveGame(g);
      expect(await repo.gamesFor(p.id)).toEqual([g]);
    });

    it("returns newest first", async () => {
      const p = await repo.createPlayer("Ava");
      await repo.saveGame(gameFor("old", p.id, [], 1));
      await repo.saveGame(gameFor("new", p.id, [], 2));
      expect((await repo.gamesFor(p.id)).map((g) => g.id)).toEqual(["new", "old"]);
    });

    it("limits", async () => {
      const p = await repo.createPlayer("Ava");
      await repo.saveGame(gameFor("a", p.id, [], 1));
      await repo.saveGame(gameFor("b", p.id, [], 2));
      expect(await repo.gamesFor(p.id, 1)).toHaveLength(1);
    });

    it("does not return other players games", async () => {
      const ava = await repo.createPlayer("Ava");
      const ben = await repo.createPlayer("Ben");
      await repo.saveGame(gameFor("g1", ava.id, []));
      expect(await repo.gamesFor(ben.id)).toEqual([]);
    });

    it("takes a players games with them when deleted", async () => {
      const p = await repo.createPlayer("Ava");
      await repo.saveGame(gameFor("g1", p.id, []));
      await repo.deletePlayer(p.id);
      expect(await repo.allGames()).toEqual([]);
    });

    it("clears", async () => {
      const p = await repo.createPlayer("Ava");
      await repo.saveGame(gameFor("g1", p.id, []));
      await repo.deleteAllGames();
      expect(await repo.allGames()).toEqual([]);
    });
  });
});

describe("the round trip that matters", () => {
  it("gives identical stats after a save and reload", async () => {
    const repo = memoryRepo();
    await repo.init();
    const ava = await repo.createPlayer("Ava");

    const log: Dart[] = [
      bed("treble", 20),
      bed("treble", 20),
      bed("treble", 20),
      bed("single", 20),
      MISS,
      INNER_BULL,
    ];
    const game: SavedGame = {
      id: "g1",
      config: X01,
      players: [ava],
      log,
      winner: null,
      playedAt: 1,
      format: null,
    };

    const before = computeStats([game], ava.id);
    await repo.saveGame(game);

    // Reload through the serialisation the SQLite driver will use.
    const [stored] = await repo.gamesFor(ava.id);
    const reloaded = {
      ...(stored as SavedGame),
      config: configFromJson(configToJson((stored as SavedGame).config)),
      log: (stored as SavedGame).log.map((d) => rowToDart(dartToRow(d))),
    };

    expect(computeStats([reloaded], ava.id)).toEqual(before);
    expect(before.maximums).toBe(1);
    expect(before.darts).toBe(6);
  });
});
