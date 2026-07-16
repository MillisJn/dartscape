import type { ReactNode } from "react";
import { View } from "react-native";

import { useLayoutMode } from "@spatch-kit/ui/responsive/useLayoutMode";

export type SettingsRowItem = {
  content: ReactNode;
  // Flex weight on desktop (default 1). Use e.g. weight 1 + weight 2 for a 1/3 · 2/3 split.
  weight?: number;
  // Fixed pixel width on desktop instead of a flex weight (e.g. a square logo column).
  width?: number;
};

// The one place to put settings shells in a row on desktop and stack them on mobile. Each item is
// wrapped in a PLAIN flex View (so the width/flex actually applies — NativeWind layout classes don't
// reliably reach through the styled card surfaces on web). Below the desktop breakpoint the items
// simply stack. Use it wherever a settings screen wants a responsive multi-column arrangement.
export function SettingsRow({ items }: { items: SettingsRowItem[] }) {
  const { isExpanded } = useLayoutMode();

  if (!isExpanded) {
    return (
      <View className="gap-app-section">
        {items.map((item, index) => (
          <View key={index}>{item.content}</View>
        ))}
      </View>
    );
  }

  return (
    <View className="flex-row items-start gap-app-section">
      {items.map((item, index) => (
        <View
          key={index}
          style={
            item.width != null ? { width: item.width } : { flex: item.weight ?? 1 }
          }
        >
          {item.content}
        </View>
      ))}
    </View>
  );
}
