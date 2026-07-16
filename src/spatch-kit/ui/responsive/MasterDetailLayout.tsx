import type { ReactNode } from "react";
import { View } from "react-native";

import { useLayoutMode } from "./useLayoutMode";

type MasterDetailLayoutProps = {
  // The list (master). Shown full-width below desktop; in a fixed-width column on desktop.
  master: ReactNode;
  // A pre-built detail node (e.g. a keyed record view) or null when nothing is
  // selected. Only mounted on desktop — below that the master is shown alone and
  // the caller uses push-navigation instead, so this element is never mounted.
  detail: ReactNode;
  // Shown in the detail pane when `detail` is null (desktop only).
  emptyDetail?: ReactNode;
};

// Two-pane on desktop (>=1024); single-pane elsewhere. Master-detail is gated to
// desktop because portrait-tablet width can't fit master + detail comfortably.
export function MasterDetailLayout({
  master,
  detail,
  emptyDetail,
}: MasterDetailLayoutProps) {
  const { isDesktop } = useLayoutMode();

  if (!isDesktop) {
    return <>{master}</>;
  }

  return (
    <View className="flex-1 flex-row">
      <View className="w-[340px] xl:w-[400px]">{master}</View>
      <View className="flex-1 border-l border-border">
        {detail ?? emptyDetail ?? null}
      </View>
    </View>
  );
}
