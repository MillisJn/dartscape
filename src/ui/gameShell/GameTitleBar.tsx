import { Text, View } from "react-native";

import { PALETTE } from "@/ui/theme/palette";

/** Flat title bar for the game screen shell — no card, no elevation, matching the
 * original's plain colored strip rather than the app's usual SectionHeader. */
export function GameTitleBar({ title }: { readonly title: string }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: PALETTE.titleBar,
        borderBottomColor: PALETTE.divider,
        borderBottomWidth: 2,
        paddingVertical: PALETTE.controlPadding,
      }}
    >
      <Text style={{ color: PALETTE.text, fontSize: 18, fontWeight: "800", letterSpacing: 1 }}>
        {title}
      </Text>
    </View>
  );
}
