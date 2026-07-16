import * as Crypto from "expo-crypto";

import { setIdGenerator } from "@/core/newId";
import { asyncStorageRepo } from "@/data/asyncStorageRepo";
import { setSoundPlayer } from "@/effects/sound";
import { createExpoSoundPlayer } from "@/effects/soundPlayer";
import { setRepo } from "@/state/repoSeam";
import { hydrateSettingsStore, useSettingsStore } from "@/state/settingsStore";

setRepo(asyncStorageRepo());
void hydrateSettingsStore();

setIdGenerator(() => Crypto.randomUUID());

// The real expo-audio backend, gated by the soundsEnabled setting — startup/ is the one place
// allowed to read both effects/ and state/, so the gate lives here rather than in the player.
const expoSoundPlayer = createExpoSoundPlayer();
setSoundPlayer((sound) => {
  if (!useSettingsStore.getState().soundsEnabled) return;
  expoSoundPlayer(sound);
});
