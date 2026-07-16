import type { GameKind } from "@/core/game/config";
import type { AppIconName } from "@/types/appIconNames";

/** Display metadata for the game picker and the setup screen's game card — one line of copy and
 * an icon per game, in the picker's 2x4 order. */
export interface GameCatalogEntry {
  readonly kind: GameKind;
  readonly label: string;
  readonly hook: string;
  readonly icon: AppIconName;
}

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  { kind: "x01", label: "X01", hook: "301 to 1501", icon: "x01" },
  { kind: "cricket", label: "CRICKET", hook: "15-20 + bull", icon: "cricket" },
  { kind: "shanghai", label: "SHANGHAI", hook: "S+D+T wins", icon: "shanghai" },
  { kind: "baseball", label: "BASEBALL", hook: "9 innings", icon: "baseball" },
  { kind: "killer", label: "KILLER", hook: "3 lives", icon: "killer" },
  { kind: "aroundTheClock", label: "AROUND CLOCK", hook: "1 → 20", icon: "aroundTheClock" },
  { kind: "halveIt", label: "HALVE IT", hook: "blank = ½", icon: "halveIt" },
  { kind: "bobs27", label: "BOB'S 27", hook: "doubles", icon: "bobs27" },
];

export function catalogEntry(kind: GameKind): GameCatalogEntry {
  const entry = GAME_CATALOG.find((e) => e.kind === kind);
  if (!entry) throw new Error(`no catalog entry for ${kind}`);
  return entry;
}
