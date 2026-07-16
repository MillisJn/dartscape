import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

// Coordinates "is the whole settings leaf ready to show?" A leaf (e.g. Account) can contain
// several independently-loading sections (profile + billing); we want to reveal the screen
// only once ALL of them are loaded, so it appears fully-formed instead of mounting piece by
// piece. Each async section registers via useLeafLoading; the gate fires onReady once every
// registered loader has reported "not loading" (or immediately if a leaf has none).

type LeafReadinessApi = {
  acquire: () => number;
  setLoading: (id: number, loading: boolean) => void;
  release: (id: number) => void;
};

const LeafReadinessContext = createContext<LeafReadinessApi | null>(null);

export function LeafReadyGate({
  onReady,
  children,
}: {
  onReady: () => void;
  children: ReactNode;
}) {
  const loadersRef = useRef(new Map<number, boolean>());
  const nextIdRef = useRef(0);
  // Don't evaluate readiness until after mount, so every child loader has had its mount
  // effect run and registered — otherwise an empty map would read as "ready" too early.
  const settledRef = useRef(false);
  const firedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const evaluate = useCallback(() => {
    if (firedRef.current || !settledRef.current) {
      return;
    }
    const loaders = loadersRef.current;
    const ready =
      loaders.size === 0 ||
      Array.from(loaders.values()).every((loading) => !loading);
    if (ready) {
      firedRef.current = true;
      onReadyRef.current();
    }
  }, []);

  const api = useMemo<LeafReadinessApi>(
    () => ({
      acquire() {
        const id = (nextIdRef.current += 1);
        loadersRef.current.set(id, true);
        return id;
      },
      setLoading(id, loading) {
        loadersRef.current.set(id, loading);
        evaluate();
      },
      release(id) {
        loadersRef.current.delete(id);
        evaluate();
      },
    }),
    [evaluate],
  );

  useEffect(() => {
    settledRef.current = true;
    evaluate();
  }, [evaluate]);

  return (
    <LeafReadinessContext.Provider value={api}>
      {children}
    </LeafReadinessContext.Provider>
  );
}

// Called by an async section: reports whether it's still loading. No-ops outside a
// LeafReadyGate (e.g. the desktop master-detail), so sections stay drop-in usable anywhere.
export function useLeafLoading(loading: boolean): void {
  const api = useContext(LeafReadinessContext);
  const idRef = useRef<number | null>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!api) {
      return;
    }
    const id = api.acquire();
    idRef.current = id;
    api.setLoading(id, loadingRef.current);
    return () => {
      api.release(id);
      idRef.current = null;
    };
  }, [api]);

  useEffect(() => {
    if (api && idRef.current != null) {
      api.setLoading(idRef.current, loading);
    }
  }, [api, loading]);
}
