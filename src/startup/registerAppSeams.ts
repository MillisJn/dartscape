import * as Crypto from "expo-crypto";

import { setIdGenerator } from "@/core/newId";
import { asyncStorageRepo } from "@/data/asyncStorageRepo";
import { setSoundPlayer } from "@/effects/sound";
import { setRepo } from "@/state/repoSeam";
import { hydrateSettingsStore, useSettingsStore } from "@/state/settingsStore";

setRepo(asyncStorageRepo());
void hydrateSettingsStore();

setIdGenerator(() => Crypto.randomUUID());

// Still no real audio backend (see effects/sound.ts's header comment) — but the settings gate is
// wired now, from the one place (startup/) allowed to read both effects/ and state/, so wiring a
// real player later is a one-line change here, not a new architectural seam.
setSoundPlayer(() => {
  if (!useSettingsStore.getState().soundsEnabled) return;
});
