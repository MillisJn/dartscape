// Device-local memory of the last REAL keyboard height (px), so a keyboard-bearing sheet can open
// ALREADY seated above the keyboard on the very first open of a session — one motion, no
// settle-then-lift jump, and no estimate.
//
// Why this exists: the OS cannot report the keyboard height while it's hidden. Android's
// getInsetsIgnoringVisibility(Type.ime()) throws by design — "the height of the IME is dynamic
// depending on the EditorInfo of the currently focused view, as well as the UI state of the IME" —
// and iOS's keyboard is a separate process with no query API. There is no single "keyboard height"
// to know ahead of time; it only resolves when a specific field shows a specific keyboard. So the
// only way to "know it at app start" is to remember the real value we last observed: capture it the
// first time the keyboard shows, persist it, and hydrate it at boot. The only irreducible gap is the
// first keyboard show EVER on a fresh install (nothing persisted yet), where consumers fall back to
// the honest live lift. Pairs with useKeyboardHeight (the live per-component subscription).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Keyboard, Platform } from "react-native";

// Kit-namespaced, not host-app-namespaced: this module is the kit's, so the key it owns is too —
// an app taking the kit inherits the behavior without inheriting another product's branding.
// (Renamed from a "spatchr."-prefixed key. No migration: the value is a self-healing UI hint that
// the listener below re-learns on the first keyboard show, so the only cost is one session where the
// first sheet uses the honest live lift — exactly the fresh-install path this already handles.)
const STORAGE_KEY = "spatchkit.ui.keyboardHeight.v1";

// Last real observed keyboard height (px). 0 = never observed (fresh install, before the keyboard
// has appeared once). Read synchronously by layout code at render, so it's a plain module value.
let lastKnownKeyboardHeight = 0;

/** The last real keyboard height observed on this device (px), or 0 if never observed. */
export function getLastKnownKeyboardHeight(): number {
  return lastKnownKeyboardHeight;
}

// Seed the in-memory value from disk once at app start (the previous session's real height), so the
// FIRST keyboard sheet of the session can reserve it. Idempotent; await or fire-and-forget.
let hydrated = false;
export async function hydrateKeyboardHeight(): Promise<void> {
  if (hydrated || Platform.OS === "web") {
    return;
  }
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw == null ? Number.NaN : Number.parseInt(raw, 10);
    // Don't clobber a value the live listener may have already captured before hydration resolved.
    if (
      Number.isFinite(parsed) &&
      parsed > 0 &&
      lastKnownKeyboardHeight === 0
    ) {
      lastKnownKeyboardHeight = parsed;
    }
  } catch {
    // Best-effort UI hint — a read failure just means the first open uses the honest live lift.
  }
}

// One global listener records every real show height into the cache + disk. Independent of any
// component's useKeyboardHeight subscription (those gate on `enabled` and unmount). Started once and
// never removed — it's app-lifetime infrastructure, not a component subscription.
let started = false;
export function startKeyboardHeightMemory(): void {
  if (started || Platform.OS === "web") {
    return;
  }
  started = true;
  // Android only emits *Did*; iOS emits *Will* (earlier/smoother). Either carries endCoordinates.
  const showEvent =
    Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  Keyboard.addListener(showEvent, (event) => {
    const height = event.endCoordinates?.height ?? 0;
    if (height > 0 && height !== lastKnownKeyboardHeight) {
      lastKnownKeyboardHeight = height;
      // Fire-and-forget; a write failure just means we re-learn it next session.
      void AsyncStorage.setItem(STORAGE_KEY, String(height)).catch(() => {});
    }
  });
}
