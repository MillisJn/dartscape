import AsyncStorage from "@react-native-async-storage/async-storage";
import { setFontFamiliesSeam } from "@spatch-kit/theme/fontFamiliesSeam";
import type { KitIconName } from "@spatch-kit/theme/iconNames";
import { defaultThemeSelection, type ThemeSelection } from "@spatch-kit/theme/theme";
import { setThemeStorageSeam } from "@spatch-kit/theme/themeStorageSeam";
import { setLoggerSeam } from "@spatch-kit/ui/overlays/core/loggerSeam";
import { registerIcons } from "@spatch-kit/ui/primitives/AppIcon";
import { setAvatarPathResolverSeam } from "@spatch-kit/ui/primitives/avatarPathSeam";
import {
  Bot,
  CircleDot,
  Clock,
  Diamond,
  Divide,
  Grid3x3,
  Hash,
  Medal,
  Skull,
  Target,
  Timer,
  Trophy,
} from "lucide-react-native";
import { Platform } from "react-native";
import type { AppIconName } from "@/types/appIconNames";

const THEME_STORAGE_KEY = "dartscape:theme";

// Dartscape bundles no typeface and loads none, so it OWNS the platform's native UI font explicitly
// rather than inheriting the kit's Inter default — whose named faces aren't loaded here, so they'd
// fall through to a system font anyway; declaring it makes that intentional (and correct on web,
// where a bogus "Inter_400Regular" family just falls through). System fonts carry their own weights,
// so every sans role points at the one family and weight comes from AppText's font-weight classes.
// To adopt a real typeface later: load it (expo-font `useFonts` + `@expo-google-fonts/…`, gated by a
// `fontsReady` barrier in app/_layout.tsx) and name it here — this is the one place the choice lives.
const systemSans = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui, sans-serif",
}) as string;
const systemMono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, monospace",
}) as string;

setFontFamiliesSeam({
  display: systemSans,
  sans: systemSans,
  sansMedium: systemSans,
  sansBold: systemSans,
  ibm: systemSans,
  mono: systemMono,
});

setThemeStorageSeam({
  async load() {
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeSelection) : defaultThemeSelection;
  },
  loadSync() {
    // No synchronous store on native; the provider falls back to its default and hydrates async.
    return null;
  },
  async persist(selection) {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(selection));
  },
});

setLoggerSeam({
  error: (tag, event, context) => console.error(`[${tag}] ${event}`, context ?? ""),
});

// No photo storage wired yet (Step 6 adds player photos via the kit's cropper) — a stored path
// resolves to itself (a cache/file URI the cropper already produced), and an empty path falls
// through to Avatar's initials fallback, which is the correct look until then.
setAvatarPathResolverSeam({
  async resolve(storedPath) {
    return storedPath || null;
  },
});

// Exclude<AppIconName, KitIconName> makes this exhaustive over exactly the nouns
// src/types/appIconNames.ts adds — a noun without a glyph fails to compile.
const appIcons: Record<Exclude<AppIconName, KitIconName>, typeof Target> = {
  dart: Target,
  bullseye: CircleDot,
  trophy: Trophy,
  bot: Bot,
  x01: Hash,
  cricket: Grid3x3,
  shanghai: Clock,
  baseball: Diamond,
  killer: Skull,
  aroundTheClock: Timer,
  halveIt: Divide,
  bobs27: Medal,
};

registerIcons(appIcons);
