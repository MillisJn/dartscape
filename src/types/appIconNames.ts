import type { KitIconName } from "@spatch-kit/theme/iconNames";
import type { GameKind } from "@/core/game/config";

/**
 * Our own icon vocabulary, layered on top of the kit's (rank 1 — a Leaf, so anything can type an
 * `icon` field against it without importing up into ui/). One name per GameKind plus four generic
 * darts nouns. `registerIcons` in startup/registerKitSeams.ts maps every one of these to a glyph —
 * `Exclude<AppIconName, KitIconName>` there makes that map exhaustive over exactly this union, so a
 * noun added here without a glyph fails to compile instead of rendering the kit's fallback.
 */
export type AppIconName = KitIconName | "dart" | "bullseye" | "trophy" | "bot" | GameKind;
