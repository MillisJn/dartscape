import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

import type { SoundName, SoundPlayer } from "./sound";

/**
 * The real audio backend for the sound seam (effects/sound.ts) — expo-audio (SDK 57),
 * replacing the inert no-op default. Ported from the original app's Sound.java SoundPool:
 * one preloaded player per effect, created lazily on first use and replayed by seeking
 * back to 0 (fire-and-forget). Wired in startup/registerAppSeams.ts, still gated there by
 * the soundsEnabled setting.
 *
 * The .ogg files live in assets/sounds/ (copied from dartscape-og/res/raw) and are bundled
 * because metro.config.js adds "ogg" to assetExts — the default list omits it.
 */

// SoundName -> asset. `require` (not import) is how Metro resolves a bundled asset to the numeric
// module id createAudioPlayer takes. Coarser than the original's per-multiplier DART1/2/3 — the
// seam only knows the semantic event, which is enough for the feedback to read right.
const SOURCES: Record<SoundName, number> = {
  dartScored: require("../../assets/sounds/dart1.ogg"),
  upgrade: require("../../assets/sounds/dart2.ogg"),
  bust: require("../../assets/sounds/buzzer.ogg"),
  won: require("../../assets/sounds/winner_trumpet.ogg"),
  targetClosed: require("../../assets/sounds/swoosh.ogg"),
  homeRun: require("../../assets/sounds/baseball_hit1.ogg"),
  miss: require("../../assets/sounds/miss.ogg"),
  scratch: require("../../assets/sounds/scratch.ogg"),
};

// Sound-effect audio session: play through the silent switch, and mix with other apps rather than
// grabbing exclusive focus (the docs' recommendation for short UI/game clips). Every field is
// spelled out because the web type wants a full AudioMode, not a partial.
const SFX_AUDIO_MODE = {
  playsInSilentMode: true,
  interruptionMode: "mixWithOthers",
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} as const;

const players = new Map<SoundName, AudioPlayer>();
let audioModeSet = false;

function playerFor(name: SoundName): AudioPlayer {
  let player = players.get(name);
  if (!player) {
    player = createAudioPlayer(SOURCES[name]);
    players.set(name, player);
  }
  return player;
}

/** Builds the real SoundPlayer. Kept as a factory (not a bare function) so nothing touches
 * native audio until startup actually installs it — importing this module alone is inert. */
export function createExpoSoundPlayer(): SoundPlayer {
  return (name) => {
    // Never let audio feedback take the game down. The likeliest failure is the native module
    // not being linked yet — expo-audio was just added, so an app built before the next
    // prebuild/rebuild has no ExpoAudio native module and every call here throws. Swallow it
    // so the game plays silently until the rebuild, rather than crashing on the first dart.
    try {
      if (!audioModeSet) {
        audioModeSet = true;
        void setAudioModeAsync(SFX_AUDIO_MODE).catch(() => {});
      }
      const player = playerFor(name);
      // Rewind first so a rapid re-tap retriggers instead of no-op-ing at the clip's end.
      player.seekTo(0);
      player.play();
    } catch {
      // no-op — see above
    }
  };
}
