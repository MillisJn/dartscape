/**
 * Our sound seam (rank 4), mirroring the kit's pattern: an inert no-op default, a real player
 * injected from startup. Inert for now — no audio backend is wired (see PLAN.md's decisions log:
 * this is unverifiable without a device, and adding a new native audio dependency here would be
 * pure risk with no way to prove it links). useGameEvents calls playSound() regardless, so wiring
 * a real backend later touches only this file and startup/registerAppSeams.ts.
 */
export type SoundName =
  | "dartScored"
  | "upgrade"
  | "bust"
  | "won"
  | "targetClosed"
  | "homeRun"
  | "miss"
  /** A number going dead (closed by everyone) — the scratch that "crosses it out". */
  | "scratch";

export type SoundPlayer = (sound: SoundName) => void;

let player: SoundPlayer = () => {};

export function setSoundPlayer(next: SoundPlayer): void {
  player = next;
}

export function playSound(sound: SoundName): void {
  player(sound);
}
