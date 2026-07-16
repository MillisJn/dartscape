import { Pressable, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { Avatar } from "@spatch-kit/ui/primitives/Avatar";

// A circular avatar (profile photo or company logo) with a small accent pencil badge in the
// bottom-right corner. Tapping anywhere opens the picker. Used in the profile and business
// profile header cards so both edit their image the same way.
export function EditableAvatar({
  disabled = false,
  name,
  onPress,
  resolvedUri,
  size = 64,
}: {
  disabled?: boolean;
  name: string;
  onPress: () => void;
  // Already-resolved (and ideally prefetched) image uri, so the avatar renders immediately.
  resolvedUri: string | null;
  size?: number;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel="Change photo"
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View>
        <Avatar name={name} resolvedUri={resolvedUri} size={size} />
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.accent,
            borderColor: theme.colors.surface,
            borderRadius: theme.radius.pill,
            borderWidth: 2,
            bottom: -2,
            height: 24,
            justifyContent: "center",
            position: "absolute",
            right: -2,
            width: 24,
          }}
        >
          <AppIcon color={theme.colors.accentContrast} name="edit" size={12} />
        </View>
      </View>
    </Pressable>
  );
}
