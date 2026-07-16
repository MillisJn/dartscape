import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  createAppTheme,
  defaultThemeSelection,
  DEFAULT_PRIMARY_COLOR,
  type AppearanceKey,
  type AppTheme,
  type CornerStyleKey,
  type DateFormatKey,
  type DensityKey,
  type MotionPreferenceKey,
  type TextScaleKey,
  type ThemeSelection,
} from "@spatch-kit/theme/theme";
import { normalizeHexColor } from "@spatch-kit/theme/colorPalette";
import { setAppDateFormat } from "@spatch-kit/theme/appDateFormat";
import {
  loadThemeSelection,
  loadThemeSelectionSync,
  persistThemeSelection,
} from "@spatch-kit/theme/themeStorageSeam";

type ThemeContextValue = {
  theme: AppTheme;
  selection: ThemeSelection;
  setAppearance: (appearance: AppearanceKey) => void;
  setPrimaryColor: (color: string) => void;
  setTextScale: (textScale: TextScaleKey) => void;
  setDensity: (density: DensityKey) => void;
  setCornerStyle: (cornerStyle: CornerStyleKey) => void;
  setMotion: (motion: MotionPreferenceKey) => void;
  setDateFormat: (dateFormat: DateFormatKey) => void;
  setShowTooltips: (showTooltips: boolean) => void;
  resetTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  // Boot-critical: read the persisted selection SYNCHRONOUSLY (web localStorage) so the very first
  // render already paints the saved theme — no flash of the default before the async load lands. Runs
  // once; the storage seam is wired at module load (startup/registerThemeStorage). Returns null on
  // native / when nothing is persisted, in which case we fall back to the default + async hydrate below.
  const syncBootRef = useRef<{ selection: ThemeSelection | null } | null>(null);
  if (syncBootRef.current === null) {
    syncBootRef.current = { selection: loadThemeSelectionSync() };
  }
  const syncBootSelection = syncBootRef.current.selection;

  const [selection, setSelection] = useState<ThemeSelection>(
    syncBootSelection ?? defaultThemeSelection,
  );
  // A synchronous boot read is already the persisted value, so treat it as hydrated: skip the async
  // load (it reads the same store) and don't re-persist the freshly-loaded selection.
  const hasHydratedRef = useRef(syncBootSelection != null);
  const lastPersistedSelectionRef = useRef<ThemeSelection | null>(
    syncBootSelection,
  );

  function selectionsMatch(left: ThemeSelection, right: ThemeSelection) {
    return (
      left.appearance === right.appearance &&
      left.primaryColor === right.primaryColor &&
      left.textScale === right.textScale &&
      left.density === right.density &&
      left.cornerStyle === right.cornerStyle &&
      left.motion === right.motion &&
      left.dateFormat === right.dateFormat &&
      left.showTooltips === right.showTooltips
    );
  }

  // Keep the module-level date formatter in sync with the selected preference (synchronously, so the
  // first paint after a boot-read or a change already formats with the right shape). Falls back for a
  // selection persisted before this preference existed.
  setAppDateFormat(selection.dateFormat ?? "weekday");

  useEffect(() => {
    // The synchronous boot read already resolved the persisted selection (web) — skip the async load
    // so there's no redundant re-render (and no chance of a late flash). Native / no-sync-store falls
    // through to the async path below.
    if (hasHydratedRef.current) {
      return;
    }
    // Storage readiness is the seam's concern: before composition (or on a web-direct install with no
    // SQLite) the inert/impl seam resolves to the default selection, so hydration is always safe to run.
    let isMounted = true;

    void loadThemeSelection()
      .then((nextSelection) => {
        if (isMounted) {
          setSelection(nextSelection);
          lastPersistedSelectionRef.current = nextSelection;
          hasHydratedRef.current = true;
        }
      })
      .catch(() => {
        lastPersistedSelectionRef.current = selection;
        hasHydratedRef.current = true;
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    if (
      lastPersistedSelectionRef.current &&
      selectionsMatch(lastPersistedSelectionRef.current, selection)
    ) {
      return;
    }

    void persistThemeSelection(selection)
      .then(() => {
        lastPersistedSelectionRef.current = selection;
      })
      .catch((error) => {
        console.warn("[theme] Failed to persist theme selection", error);
      });
  }, [selection]);

  const value = useMemo<ThemeContextValue>(() => {
    const theme = createAppTheme(selection);

    return {
      theme,
      selection,
      setAppearance(appearance) {
        setSelection((current) => ({ ...current, appearance }));
      },
      setPrimaryColor(color) {
        // Repair anything unparseable (incl. the picker's "no color" "") to the
        // default so the accent never ends up empty/invalid.
        const primaryColor = normalizeHexColor(color) ?? DEFAULT_PRIMARY_COLOR;
        setSelection((current) => ({ ...current, primaryColor }));
      },
      setTextScale(textScale) {
        setSelection((current) => ({ ...current, textScale }));
      },
      setDensity(density) {
        setSelection((current) => ({ ...current, density }));
      },
      setCornerStyle(cornerStyle) {
        setSelection((current) => ({ ...current, cornerStyle }));
      },
      setMotion(motion) {
        setSelection((current) => ({ ...current, motion }));
      },
      setDateFormat(dateFormat) {
        setSelection((current) => ({ ...current, dateFormat }));
      },
      setShowTooltips(showTooltips) {
        setSelection((current) => ({ ...current, showTooltips }));
      },
      resetTheme() {
        setSelection(defaultThemeSelection);
      },
    };
  }, [selection]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

function useThemeContext() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error(
      "Theme context is not available. Wrap the app in AppThemeProvider.",
    );
  }

  return value;
}

export function useTheme() {
  return useThemeContext().theme;
}

export function useThemeController() {
  const {
    selection,
    setAppearance,
    setPrimaryColor,
    setTextScale,
    setDensity,
    setCornerStyle,
    setMotion,
    setDateFormat,
    setShowTooltips,
    resetTheme,
  } = useThemeContext();

  return {
    selection,
    setAppearance,
    setPrimaryColor,
    setTextScale,
    setDensity,
    setCornerStyle,
    setMotion,
    setDateFormat,
    setShowTooltips,
    resetTheme,
  };
}
