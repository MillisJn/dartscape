import { requestOverlayDismissal } from "@spatch-kit/ui/overlays/core/dismissal";

import { createNavigationService } from "./navigationService";

const navigationService = createNavigationService({
  onBeforeNavigation: requestOverlayDismissal,
});

export function syncNavigationRoute(routeKey: string) {
  navigationService.syncRoute(routeKey);
}

export function goBackOnce(goBack: () => void) {
  return navigationService.goBackOnce(goBack);
}

export function pushHrefOnce(push: (href: string) => void, href: string) {
  return navigationService.pushHrefOnce(push, href);
}

export function replaceHrefOnce(replace: (href: string) => void, href: string) {
  return navigationService.replaceHrefOnce(replace, href);
}

export function navigateHrefOnce(
  navigate: (href: string) => void,
  href: string,
) {
  return navigationService.navigateHrefOnce(navigate, href);
}

export function buildRouteKey(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
) {
  return navigationService.buildRouteKey(pathname, params);
}

// expo-router's useGlobalSearchParams() returns the dynamic *path-segment* params
// (domainKey + id, from /[domainKey]/[id], /[domainKey]/edit/[id] and
// /[domainKey]/create) merged in with real query params. Those segment values are
// already encoded in the pathname, so leaving them in makes the observed route key
// (pathname + params) diverge from the clean hrefs we push — e.g. the live screen reads
// "/contacts/edit/1?domainKey=contacts&id=1" while we pushed "/contacts/edit/1". That
// divergence silently defeats the same-route dedupe guard in beginNavigation, so a quick
// double/triple tap stacks duplicate screens. Strip the segment params here so the
// observed key matches the pushed href exactly and the guard can fire.
const DYNAMIC_ROUTE_SEGMENT_PARAM_KEYS = ["domainKey", "id"];

export function stripDynamicSegmentParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const queryParams: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(params)) {
    if (DYNAMIC_ROUTE_SEGMENT_PARAM_KEYS.includes(key)) {
      continue;
    }

    queryParams[key] = value;
  }

  return queryParams;
}
