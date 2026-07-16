import "../global.css";
import "@/startup";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { AppThemeProvider, useTheme } from "@spatch-kit/theme/provider";
import { OverlayPlaneProvider } from "@spatch-kit/ui/overlays/core/OverlayPlaneProvider";
import { OverlayHost } from "@spatch-kit/ui/overlays/core/OverlayHost";
import { AppAlertHost } from "@spatch-kit/ui/overlays/system/AppAlertHost";
import { AppFeedbackHost } from "@spatch-kit/ui/overlays/system/AppFeedbackHost";

import { ThemeVarsRoot } from "@/ui/ThemeVarsRoot";

// Screen deliberately paints no background of its own (see its header comment) — the navigator's
// contentStyle is what's actually behind every screen, so it has to carry the theme color.
function RootStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

// The provider stack + exactly one <OverlayHost/> — it owns the app's single BackHandler and a
// dev invariant throws if a second one ever mounts.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <ThemeVarsRoot>
            <OverlayPlaneProvider>
              <RootStack />
              <OverlayHost />
              <AppFeedbackHost />
              <AppAlertHost />
            </OverlayPlaneProvider>
          </ThemeVarsRoot>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
