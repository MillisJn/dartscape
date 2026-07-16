import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@spatch-kit/theme/provider";
import { OverlayPortal } from "@spatch-kit/ui/overlays/core/OverlayPortal";
import { useOverlayRegistration } from "@spatch-kit/ui/overlays/core/dismissal";
import { PopoverTransition } from "@spatch-kit/ui/animated/PopoverTransition";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { PressableTint } from "@spatch-kit/ui/primitives/pressFeedback";

export type FloatingActionMenuNode = {
  children?: FloatingActionMenuNode[];
  // Stable identity of this item's action (entityActionExecutionKey), carried so a host can dedupe
  // a leaf item against an inline quick action that runs the same execution. The menu itself
  // ignores it. Absent for items with no execution (e.g. the standard Edit / Delete).
  dedupeKey?: string;
  icon?: IconName;
  key: string;
  label: string;
  // When present and there are no static `children`, the menu calls this on drill-in,
  // shows a loading state, caches the result, then renders the loaded children.
  loadChildren?: () => Promise<FloatingActionMenuNode[]>;
  onPress?: () => void;
};

type FloatingActionMenuProps = {
  anchorPoint?: {
    x: number;
    y: number;
  } | null;
  bottom?: number;
  items: FloatingActionMenuNode[];
  onClose: () => void;
  right?: number;
  visible: boolean;
};

const MENU_WIDTH = 220;
const WINDOW_PADDING = 12;
const OPTION_HEIGHT = 56;
// Extra lift above an explicit FAB `bottom`, so the menu clears the round button's drop shadow +
// focus ring (which extend ~10px beyond its 64px face). Without it the menu sits ~8px off the face
// and the button's shadow overlaps the menu's bottom edge — reading as "button in front / menu too
// low." Applies only to the FAB-anchored (`bottom`) case, not the anchorPoint/default paths.
const FAB_ANCHOR_CLEARANCE = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMenuHeight(
  items: FloatingActionMenuNode[],
  includeHeader: boolean,
) {
  return items.length * OPTION_HEIGHT + (includeHeader ? OPTION_HEIGHT : 0);
}

function findNode(items: FloatingActionMenuNode[], key: string) {
  return items.find((item) => item.key === key) ?? null;
}

export function FloatingActionMenu({
  anchorPoint,
  bottom,
  items,
  onClose,
  right,
  visible,
}: FloatingActionMenuProps) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activePath, setActivePath] = useState<string[]>([]);
  // Children loaded lazily on drill-in (keyed by node key, which is unique in the tree),
  // and the node currently fetching. Cleared when the menu closes so a reopen re-fetches.
  const [loadedChildren, setLoadedChildren] = useState<
    Record<string, FloatingActionMenuNode[]>
  >({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  // Overlay lifecycle copied from AppAlertHost so the menu fades in/out identically to the alert:
  //  • `rendered` keeps the portal mounted through the EXIT animation (smooth fade-out).
  //  • `ready` gates the ENTRANCE until the portal is on screen, so PopoverTransition mounts hidden
  //    and fades IN rather than popping in at full opacity.
  const [rendered, setRendered] = useState(visible);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    // Keep mounted for the exit fade, then GUARANTEE unmount via a timer. PopoverTransition's
    // onExitComplete is the fast path, but if the menu closed before its entrance ever ran (a rapid
    // open→close during an overlay handoff — e.g. tapping the FAB while a filter menu is open), that
    // callback never fires, and this menu's full-screen backdrop would stay mounted forever,
    // silently blocking every tap (the FAB "quits working"). The timer makes that impossible.
    const timer = setTimeout(
      () => setRendered(false),
      theme.motion.duration.normal + 40,
    );
    return () => clearTimeout(timer);
  }, [visible, theme.motion.duration.normal]);
  useEffect(() => {
    if (!rendered) {
      setReady(false);
    } else if (Platform.OS === "web") {
      setReady(true);
    }
  }, [rendered]);
  useOverlayRegistration(visible, onClose);

  // Reset drill-in state once the menu is fully closed (after the exit fade) so the content
  // stays stable while it fades out and a reopen starts at the root level.
  useEffect(() => {
    if (!rendered) {
      setActivePath([]);
      setLoadedChildren({});
      setLoadingKey(null);
    }
  }, [rendered]);

  const menuLevels = useMemo(() => {
    const levels: Array<{
      items: FloatingActionMenuNode[];
      parentLabel?: string;
    }> = [{ items }];
    let currentItems = items;

    for (const key of activePath) {
      const nextNode = findNode(currentItems, key);
      const childItems = nextNode?.children?.length
        ? nextNode.children
        : (nextNode && loadedChildren[key]) || undefined;

      if (!childItems?.length) {
        break;
      }

      levels.push({
        items: childItems,
        parentLabel: nextNode?.label,
      });
      currentItems = childItems;
    }

    return levels;
  }, [activePath, items, loadedChildren]);
  const activeLevel = menuLevels[menuLevels.length - 1] ?? {
    items,
    parentLabel: undefined,
  };

  if (!rendered || items.length === 0) {
    return null;
  }

  const menuHeight = getMenuHeight(activeLevel.items, menuLevels.length > 1);
  const rootLeft = anchorPoint
    ? clamp(
        anchorPoint.x + 8,
        WINDOW_PADDING,
        window.width - MENU_WIDTH - WINDOW_PADDING,
      )
    : clamp(
        window.width - MENU_WIDTH - (right ?? theme.space.md),
        WINDOW_PADDING,
        window.width - MENU_WIDTH - WINDOW_PADDING,
      );
  const bottomBound =
    window.height - menuHeight - WINDOW_PADDING - insets.bottom;
  // A tap-anchored menu (`anchorPoint`) is pinned by its TOP at the tap point. A FAB / bar-anchored
  // menu (an explicit `bottom`, or the default) is pinned by its BOTTOM edge instead — a fixed
  // distance above the screen bottom, INDEPENDENT of item count. Top-anchoring it from the ESTIMATED
  // height (getMenuHeight) let the real bottom edge drift down INTO the button whenever the items
  // changed and the estimate was off — a menu would drop onto its own FAB as soon as a conditional
  // item appeared. Bottom-anchoring makes the gap above the button exactly consistent, always.
  //
  // The explicit `bottom` is a raw screen-bottom offset that already matches its FAB (positioned from
  // the raw screen bottom, above the bar), so it is NOT given the bottom safe-area inset — only a
  // small clearance for the button's shadow/ring. The default (no `bottom`) case clears the home
  // indicator itself.
  const menuBottomInset =
    bottom != null
      ? bottom + FAB_ANCHOR_CLEARANCE
      : theme.space.xl + insets.bottom;
  const rootTop = anchorPoint
    ? clamp(anchorPoint.y + 8, WINDOW_PADDING, bottomBound)
    : undefined;

  const overlayBody = (
    <>
      <Pressable
        accessibilityLabel="Close action menu"
        accessibilityRole="button"
        onPress={onClose}
        style={{
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          zIndex: 34,
        }}
      />

      {/* PopoverTransition IS the alert card's transition (the smoothest fade). Shadow + fill on its
          animated node so the drop shadow fades WITH the menu; the inner View clips the corners. */}
      <PopoverTransition
        visible={visible && ready}
        onExitComplete={() => setRendered(false)}
        style={{
          position: "absolute",
          left: rootLeft,
          // Tap-anchored → pin by top; FAB / bar-anchored → pin by bottom (see above).
          ...(anchorPoint ? { top: rootTop } : { bottom: menuBottomInset }),
          width: MENU_WIDTH,
          zIndex: 35,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceRaised,
          // boxShadow (NOT elevation) so it fades with the menu and never flickers a map underneath.
          boxShadow: theme.shadow.overlay.boxShadow,
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: theme.borderWidth.sm,
            borderColor: theme.colors.border,
            overflow: "hidden",
          }}
        >
          {menuLevels.length > 1 ? (
            <PressableTint
              accessibilityLabel={activeLevel.parentLabel ?? "Back"}
              accessibilityRole="button"
              className="flex-row items-center gap-app-sm border-b border-border px-app-md py-app-md hover:bg-background-muted"
              onPress={() => {
                setActivePath((current) => current.slice(0, -1));
              }}
            >
              <AppIcon alignText name="chevronLeft" />
              <AppText numberOfLines={1} variant="body">
                {activeLevel.parentLabel ?? "Back"}
              </AppText>
            </PressableTint>
          ) : null}

          {activeLevel.items.map((item) => {
            const hasStaticChildren = Boolean(item.children?.length);
            const isMenuItem = hasStaticChildren || Boolean(item.loadChildren);
            const isLoading = loadingKey === item.key;

            return (
              <PressableTint
                key={item.key}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, expanded: isMenuItem ? false : undefined }}
                className="flex-row items-center gap-app-sm border-b border-border px-app-md py-app-md last:border-b-0 hover:bg-background-muted"
                disabled={isLoading}
                onPress={() => {
                  if (hasStaticChildren) {
                    setActivePath((current) => [...current, item.key]);
                    return;
                  }

                  if (item.loadChildren) {
                    if (loadedChildren[item.key]) {
                      setActivePath((current) => [...current, item.key]);
                      return;
                    }

                    if (loadingKey) {
                      return;
                    }

                    setLoadingKey(item.key);
                    void item
                      .loadChildren()
                      .then((children) => {
                        setLoadedChildren((current) => ({
                          ...current,
                          [item.key]: children,
                        }));

                        if (children.length > 0) {
                          setActivePath((current) => [...current, item.key]);
                        }
                      })
                      .catch(() => {})
                      .finally(() => {
                        setLoadingKey(null);
                      });
                    return;
                  }

                  item.onPress?.();
                  onClose();
                }}
              >
                {item.icon ? <AppIcon alignText name={item.icon} /> : null}
                <View className="flex-1">
                  <AppText variant="body">{item.label}</AppText>
                </View>
                {isLoading ? (
                  <ActivityIndicator
                    color={theme.colors.mutedText}
                    size="small"
                  />
                ) : isMenuItem ? (
                  <AppIcon name="chevronRight" />
                ) : null}
              </PressableTint>
            );
          })}
        </View>
      </PopoverTransition>
    </>
  );

  return (
    <OverlayPortal
      active={visible}
      animationType="none"
      onRequestClose={onClose}
      onShow={() => setReady(true)}
      visible
    >
      {overlayBody}
    </OverlayPortal>
  );
}
