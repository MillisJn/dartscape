// Theme-persistence seam. The theme provider (a leaf token/context module) must load & save the
// user's theme selection, which lives in the app database — a Data-tier concern it may not import
// directly (that was the theme→data upward edge). So theme declares this seam with an inert default;
// the composition root (registerWritePolicy) injects the real db-backed impl
// (app/src/data/theme/themeStorage.ts) at startup, before the provider's hydration effect runs.
import { defaultThemeSelection, type ThemeSelection } from "@spatch-kit/theme/theme";

export type ThemeStorageSeam = {
  // Resolve the persisted selection (or the default when storage is unavailable / not yet ready).
  load: () => Promise<ThemeSelection>;
  // Synchronous read for the boot-critical first paint: the persisted selection, or null when there
  // is no synchronous store (native) or nothing is persisted. The provider seeds its initial state
  // from this so the correct theme renders on the very first frame instead of flashing the default.
  loadSync: () => ThemeSelection | null;
  persist: (selection: ThemeSelection) => Promise<void>;
};

// Inert default: no persistence. Returns the default selection and swallows writes, so an
// unregistered runtime (pre-composition, a bare import, a unit test) behaves as "no stored theme".
const inert: ThemeStorageSeam = {
  load: async () => defaultThemeSelection,
  loadSync: () => null,
  persist: async () => {},
};

let seam: ThemeStorageSeam = inert;

export function setThemeStorageSeam(next: Partial<ThemeStorageSeam>): void {
  seam = { ...seam, ...next };
}

export function loadThemeSelection(): Promise<ThemeSelection> {
  return seam.load();
}

export function loadThemeSelectionSync(): ThemeSelection | null {
  return seam.loadSync();
}

export function persistThemeSelection(selection: ThemeSelection): Promise<void> {
  return seam.persist(selection);
}
