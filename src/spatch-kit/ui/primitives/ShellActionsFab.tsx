import { Platform } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import type { IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { FloatingActionButton } from "@spatch-kit/ui/primitives/FloatingActionButton";
import {
  FloatingActionMenu,
  type FloatingActionMenuNode,
} from "@spatch-kit/ui/primitives/FloatingActionMenu";

// FAB face size — keep in sync with FloatingActionButton's FAB_SIZE.
const FAB_SIZE = 64;

type ShellActionsFabProps = {
  accessibilityLabel: string;
  icon?: IconName;
  items: FloatingActionMenuNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The BUTTON shows only when true; the MENU stays mounted regardless (for its exit fade) and hides
  // itself via `open`. Splitting them lets the button hide under a blocking overlay while its own
  // menu — itself an overlay — stays up.
  buttonVisible: boolean;
  // Override the button's distance from the screen bottom (the menu tracks it). Defaults to the value
  // that clears the permanent bottom nav bar. Pass a smaller value when the FAB floats inside a
  // full-screen sheet that covers the bar (e.g. Reports in the More sheet) — there the caller bakes in
  // the safe-area inset itself.
  bottomOffset?: number;
};

// THE shared shell actions FAB + its popup menu. Every screen that floats a bottom-right actions
// button (record detail, Reports) renders this, so the button height AND the menu's gap above it are
// IDENTICAL everywhere — no more a menu sitting higher on one screen and lower/behind the button on
// another. Positioning lives HERE and nowhere else.
export function ShellActionsFab({
  accessibilityLabel,
  icon = "moreVertical",
  items,
  open,
  onOpenChange,
  buttonVisible,
  bottomOffset,
}: ShellActionsFabProps) {
  const theme = useTheme();
  // The FAB floats clear above the permanent bottom nav bar (AppShellNavigation) — a touch lower than
  // it used to sit. Web's bar is shorter (no gesture inset) than native's. A caller inside a full-screen
  // sheet (no bar underneath) overrides this with its own smaller, inset-aware offset.
  const fabBottomOffset =
    bottomOffset ?? theme.space.xl + (Platform.OS === "web" ? 40 : 96);
  // Anchor the menu's BOTTOM edge at the FAB's TOP edge; FloatingActionMenu adds its own small
  // FAB_ANCHOR_CLEARANCE, which becomes the (tight, consistent) gap above the button. Because that
  // menu now pins by its bottom edge (not a top computed from an estimated height), this gap stays
  // exactly the same no matter how many items the menu has.
  const menuBottom = fabBottomOffset + FAB_SIZE;

  return (
    <>
      <FloatingActionMenu
        bottom={menuBottom}
        items={items}
        onClose={() => onOpenChange(false)}
        right={theme.space.md}
        visible={open}
      />
      {buttonVisible ? (
        <FloatingActionButton
          accessibilityLabel={accessibilityLabel}
          bottomOffset={fabBottomOffset}
          icon={icon}
          onPress={() => onOpenChange(!open)}
        />
      ) : null}
    </>
  );
}
