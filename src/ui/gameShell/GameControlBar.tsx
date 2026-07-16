import type { PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PALETTE } from "@/ui/theme/palette";

/** Flat, transparent-background control bar (top divider stroke, no shadow) — the
 * original's control bar, not the app's usual raised/bordered BottomActionBar. Owns
 * the safe-area bottom inset itself since it's always the screen's true bottom edge. */
export function GameControlBar({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: PALETTE.control,
        borderTopColor: PALETTE.divider,
        borderTopWidth: 2,
        flexDirection: "row",
        paddingBottom: PALETTE.controlPadding + insets.bottom,
        paddingHorizontal: PALETTE.controlPadding,
        paddingTop: PALETTE.controlPadding,
      }}
    >
      {children}
    </View>
  );
}

export interface GameControlButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export function GameControlButton({ label, onPress, disabled }: GameControlButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        flex: 1,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        paddingVertical: PALETTE.controlPadding,
      })}
    >
      <Text style={{ color: PALETTE.text, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}
