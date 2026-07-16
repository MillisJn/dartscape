import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * Our own app-level settings — bot speed, sounds, checkout hints. Separate from the kit's theme
 * selection (that's its own persisted store, wired via themeStorageSeam); this one is ours to
 * define, so it's a plain zustand store like matchStore rather than another kit seam.
 */

export type BotSpeed = "fast" | "normal" | "slow";

export const BOT_SPEED_MS: Record<BotSpeed, number> = {
  fast: 350,
  normal: 700,
  slow: 1200,
};

export interface SettingsState {
  readonly botSpeed: BotSpeed;
  readonly soundsEnabled: boolean;
  /** On by default — see PLAN.md's decisions log ("checkout hints on by default"). */
  readonly checkoutHintsEnabled: boolean;
}

export interface SettingsActions {
  setBotSpeed(speed: BotSpeed): void;
  setSoundsEnabled(enabled: boolean): void;
  setCheckoutHintsEnabled(enabled: boolean): void;
}

export type SettingsStore = SettingsState & SettingsActions;

const STORAGE_KEY = "dartscape:settings";

const DEFAULTS: SettingsState = {
  botSpeed: "normal",
  soundsEnabled: true,
  checkoutHintsEnabled: true,
};

function persist(state: SettingsState): void {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,

  setBotSpeed(botSpeed) {
    set({ botSpeed });
    persist(get());
  },

  setSoundsEnabled(soundsEnabled) {
    set({ soundsEnabled });
    persist(get());
  },

  setCheckoutHintsEnabled(checkoutHintsEnabled) {
    set({ checkoutHintsEnabled });
    persist(get());
  },
}));

/** Hydrate from AsyncStorage — called once from startup, module load. */
export async function hydrateSettingsStore(): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const stored = JSON.parse(raw) as Partial<SettingsState>;
    useSettingsStore.setState({ ...DEFAULTS, ...stored });
  } catch {
    // Corrupt/old shape — fall back to defaults already set.
  }
}
