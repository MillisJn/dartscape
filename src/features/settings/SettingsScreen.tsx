import {
  AppearancePicker,
  CornerStylePicker,
  densityLabels,
  motionPreferenceLabels,
  textScaleLabels,
} from "@spatch-kit/settings/ThemeControls";
import { useTheme, useThemeController } from "@spatch-kit/theme/provider";
import { accentSwatchesFor } from "@spatch-kit/theme/theme";
import { showAppAlert } from "@spatch-kit/ui/overlays/system/appAlertController";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Screen } from "@spatch-kit/ui/primitives/Screen";
import { SectionHeader } from "@spatch-kit/ui/primitives/SectionHeader";
import { SegmentedField } from "@spatch-kit/ui/primitives/SegmentedField";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { getRepo } from "@/state/repoSeam";
import { type BotSpeed, useSettingsStore } from "@/state/settingsStore";

const BOT_SPEED_OPTIONS: Array<{ label: string; value: BotSpeed }> = [
  { label: "SLOW", value: "slow" },
  { label: "NORMAL", value: "normal" },
  { label: "FAST", value: "fast" },
];

const ON_OFF = [
  { label: "OFF", value: "off" },
  { label: "ON", value: "on" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-app-sm">
      <SectionHeader borderless title={title} titleVariant="caption" />
      <View className="gap-app-md px-app-md">{children}</View>
    </View>
  );
}

/**
 * Appearance (the kit's theme controls, composed here — only AppearancePicker and
 * CornerStylePicker ship as ready-made components; text scale/density/motion/accent are theme
 * label maps this screen turns into SegmentedFields/swatches itself. Logged in PLAN.md.) plus a
 * Dartscape section: bot speed, sounds, checkout hints, and a destructive clear-stats action.
 */
export function SettingsScreen() {
  const theme = useTheme();
  const controller = useThemeController();
  const botSpeed = useSettingsStore((s) => s.botSpeed);
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const checkoutHintsEnabled = useSettingsStore((s) => s.checkoutHintsEnabled);
  const setBotSpeed = useSettingsStore((s) => s.setBotSpeed);
  const setSoundsEnabled = useSettingsStore((s) => s.setSoundsEnabled);
  const setCheckoutHintsEnabled = useSettingsStore((s) => s.setCheckoutHintsEnabled);

  async function clearAllStats() {
    const value = await showAppAlert({
      title: "Clear all stats?",
      message: "Every saved game is deleted. This can't be undone.",
      buttons: [
        { text: "Cancel", style: "cancel", value: "cancel" },
        { text: "Clear", style: "destructive", value: "clear" },
      ],
    });
    if (value === "clear") await getRepo().deleteAllGames();
  }

  return (
    <Screen className="bg-background">
      <SectionHeader title="SETTINGS" titleVariant="hero" />
      <ScrollView contentContainerStyle={{ gap: 24, padding: 16 }}>
        <Section title="APPEARANCE">
          <AppearancePicker
            onChange={controller.setAppearance}
            value={controller.selection.appearance}
          />

          <View className="gap-app-xs">
            <AppText color="mutedText" variant="caption">
              Accent
            </AppText>
            <View className="flex-row flex-wrap gap-app-sm">
              {accentSwatchesFor(controller.selection.appearance).map((hex) => (
                <Pressable key={hex} onPress={() => controller.setPrimaryColor(hex)}>
                  <View
                    style={{
                      backgroundColor: hex,
                      borderRadius: 999,
                      borderWidth: hex === controller.selection.primaryColor ? 3 : 0,
                      borderColor: theme.colors.text,
                      height: 32,
                      width: 32,
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-app-xs">
            <AppText color="mutedText" variant="caption">
              Corners
            </AppText>
            <CornerStylePicker
              onChange={controller.setCornerStyle}
              value={controller.selection.cornerStyle}
            />
          </View>

          <SegmentedField
            label="Text size"
            onChange={(v) => controller.setTextScale(v as typeof controller.selection.textScale)}
            options={Object.entries(textScaleLabels).map(([value, label]) => ({ value, label }))}
            value={controller.selection.textScale}
          />
          <SegmentedField
            label="Density"
            onChange={(v) => controller.setDensity(v as typeof controller.selection.density)}
            options={Object.entries(densityLabels).map(([value, label]) => ({ value, label }))}
            value={controller.selection.density}
          />
          <SegmentedField
            label="Motion"
            onChange={(v) => controller.setMotion(v as typeof controller.selection.motion)}
            options={Object.entries(motionPreferenceLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            value={controller.selection.motion}
          />
        </Section>

        <Section title="DARTSCAPE">
          <SegmentedField
            label="Bot speed"
            onChange={(v) => setBotSpeed(v as BotSpeed)}
            options={BOT_SPEED_OPTIONS}
            value={botSpeed}
          />
          <SegmentedField
            label="Sounds"
            onChange={(v) => setSoundsEnabled(v === "on")}
            options={ON_OFF}
            value={soundsEnabled ? "on" : "off"}
          />
          <SegmentedField
            label="Checkout hints"
            onChange={(v) => setCheckoutHintsEnabled(v === "on")}
            options={ON_OFF}
            value={checkoutHintsEnabled ? "on" : "off"}
          />

          <Pressable onPress={clearAllStats}>
            <AppText color="danger" variant="label">
              CLEAR ALL STATS
            </AppText>
          </Pressable>
        </Section>
      </ScrollView>
    </Screen>
  );
}
