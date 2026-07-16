import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { type Dart, isMiss, label, points } from "@/core/board";

export interface VisitStripProps {
  readonly darts: readonly Dart[];
}

function chipColor(dart: Dart, theme: ReturnType<typeof useTheme>): string {
  if (isMiss(dart)) return theme.colors.mutedText;
  switch (dart.ring) {
    case "single":
    case "outerBull":
      return theme.colors.success;
    case "double":
      return theme.colors.accent;
    case "treble":
    case "innerBull":
      return theme.colors.warning;
  }
}

/** This visit's darts, one chip each, coloured by multiplier — and where the upgrade animation
 * happens (the plan's "watch it land"). Props only — no store. */
export function VisitStrip({ darts }: VisitStripProps) {
  const theme = useTheme();
  const total = darts.reduce((sum, d) => sum + points(d), 0);

  return (
    <View className="flex-row items-center justify-center gap-app-sm p-app-sm">
      {[0, 1, 2].map((i) => {
        const dart = darts[i];
        return (
          <View
            className="min-w-[56px] items-center rounded-app-sm border border-border-strong px-app-sm py-app-xs"
            key={i}
            style={dart ? { borderColor: chipColor(dart, theme) } : undefined}
          >
            <AppText color={dart ? undefined : "mutedText"} variant="label">
              {dart ? label(dart) : "·"}
            </AppText>
          </View>
        );
      })}
      <AppText variant="sectionTitle">{`= ${total}`}</AppText>
    </View>
  );
}
