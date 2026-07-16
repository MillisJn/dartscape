function normalizeNavigationHref(href: string) {
  const [rawPathname, rawQuery = ""] = href.split("?");
  const pathname = rawPathname || "/";

  if (!rawQuery) {
    return pathname;
  }

  const params = new URLSearchParams(rawQuery);
  const normalizedEntries = [...params.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (normalizedEntries.length === 0) {
    return pathname;
  }

  return `${pathname}?${new URLSearchParams(normalizedEntries).toString()}`;
}

type ActiveNavigation = {
  hasRouteChange: boolean;
  sourceRouteKey: string | null;
  targetRouteKey: string | null;
};

// A navigation normally releases the in-flight lock when `syncRoute` observes
// the resulting route change. This watchdog is the fallback for a navigate that
// never produces one (e.g. the target resolves to the screen we are already on,
// or the call is dropped while the app returns from an external activity such as
// the storage folder picker): without it the lock would stay held forever and
// silently disable all further navigation. A real navigation updates the route
// state on the next render and clears the lock long before this fires.
const NAVIGATION_SETTLE_TIMEOUT_MS = 250;

export function createNavigationService(options?: {
  onBeforeNavigation?: () => void;
}) {
  let activeNavigation: ActiveNavigation | null = null;
  let currentRouteKey: string | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSettleTimer() {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  }

  function clearActiveNavigation() {
    clearSettleTimer();
    activeNavigation = null;
  }

  function armSettleWatchdog() {
    clearSettleTimer();
    const pendingNavigation = activeNavigation;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (
        activeNavigation !== null &&
        activeNavigation === pendingNavigation &&
        !activeNavigation.hasRouteChange
      ) {
        activeNavigation = null;
      }
    }, NAVIGATION_SETTLE_TIMEOUT_MS);
    // Don't let the watchdog keep a Node process (tests) alive; no-op on native.
    const timerHandle = settleTimer as unknown as { unref?: () => void };
    if (typeof timerHandle.unref === "function") {
      timerHandle.unref();
    }
  }

  function finalizeNavigationIfSettled() {
    if (!activeNavigation) {
      return;
    }

    if (activeNavigation.hasRouteChange) {
      clearActiveNavigation();
      return;
    }

    if (currentRouteKey === activeNavigation.sourceRouteKey) {
      clearActiveNavigation();
    }
  }

  function beginNavigation(targetRouteKey: string | null) {
    if (activeNavigation) {
      return false;
    }

    if (targetRouteKey && currentRouteKey === targetRouteKey) {
      return false;
    }

    options?.onBeforeNavigation?.();
    activeNavigation = {
      hasRouteChange: false,
      sourceRouteKey: currentRouteKey,
      targetRouteKey,
    };
    armSettleWatchdog();

    return true;
  }

  function runNavigationOnce(navigate: (href: string) => void, href: string) {
    const targetRouteKey = normalizeNavigationHref(href);

    if (!beginNavigation(targetRouteKey)) {
      return false;
    }

    try {
      navigate(href);
      return true;
    } catch (error) {
      clearActiveNavigation();
      throw error;
    }
  }

  return {
    buildRouteKey(
      pathname: string,
      params: Record<string, string | string[] | undefined>,
    ) {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(params).sort(
        ([left], [right]) => left.localeCompare(right),
      )) {
        if (Array.isArray(value)) {
          for (const entry of value) {
            searchParams.append(key, entry);
          }

          continue;
        }

        if (typeof value === "string") {
          searchParams.append(key, value);
        }
      }

      const query = searchParams.toString();

      return query ? `${pathname}?${query}` : pathname;
    },
    getState() {
      return {
        activeNavigation,
        currentRouteKey,
      };
    },
    goBackOnce(goBack: () => void) {
      if (!beginNavigation(null)) {
        return false;
      }

      try {
        goBack();
        return true;
      } catch (error) {
        clearActiveNavigation();
        throw error;
      }
    },
    navigateHrefOnce(navigate: (href: string) => void, href: string) {
      return runNavigationOnce(navigate, href);
    },
    normalizeHref(href: string) {
      return normalizeNavigationHref(href);
    },
    pushHrefOnce(push: (href: string) => void, href: string) {
      return runNavigationOnce(push, href);
    },
    replaceHrefOnce(replace: (href: string) => void, href: string) {
      return runNavigationOnce(replace, href);
    },
    reset() {
      clearSettleTimer();
      activeNavigation = null;
      currentRouteKey = null;
    },
    syncRoute(routeKey: string) {
      const normalizedRouteKey = normalizeNavigationHref(routeKey);
      const previousRouteKey = currentRouteKey;
      currentRouteKey = normalizedRouteKey;

      if (activeNavigation && previousRouteKey !== normalizedRouteKey) {
        activeNavigation.hasRouteChange = true;
      }

      finalizeNavigationIfSettled();
    },
  };
}

export type NavigationService = ReturnType<typeof createNavigationService>;
