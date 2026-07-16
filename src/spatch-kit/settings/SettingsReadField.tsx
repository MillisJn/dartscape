import { View } from "react-native";

import { AppText } from "@spatch-kit/ui/primitives/AppText";

// A single label + value row for the read mode of a settings card — mirrors how an entity
// detail view shows a field (muted label above the value, "Not set" when empty).
export function SettingsReadField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const text = value?.trim();

  return (
    <View className="gap-app-xxs">
      <AppText color="mutedText" variant="caption">
        {label}
      </AppText>
      <AppText color={text ? undefined : "mutedText"} variant="body">
        {text || "Not set"}
      </AppText>
    </View>
  );
}
