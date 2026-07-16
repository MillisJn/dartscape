import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { PopoverTransition } from "@spatch-kit/ui/animated/PopoverTransition";
import { OverlayPortal } from "@spatch-kit/ui/overlays/core/OverlayPortal";
import { FormSurface } from "@spatch-kit/ui/primitives/FormSurface";
import { AppText } from "@spatch-kit/ui/primitives/AppText";

import {
  getAppFeedbackState,
  subscribeAppFeedback,
  type AppToastState,
} from "./appFeedbackController";

export function AppFeedbackHost() {
  const theme = useTheme();
  const [state, setState] = useState(getAppFeedbackState);

  useEffect(() => subscribeAppFeedback(setState), []);

  const loadingOverlay = state.loadingOverlay;

  const loadingBody = loadingOverlay ? (
    <>
      <View
        className="absolute inset-0"
        style={{ backgroundColor: theme.colors.surfaceOverlay }}
      />
      <View className="absolute inset-0 items-center justify-center px-app-md">
        <FormSurface
          className="w-full max-w-[320px] items-center gap-app-sm"
          motion="none"
          padding="md"
          tone="raised"
          style={{ boxShadow: theme.shadow.overlay.boxShadow }}
        >
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <AppText className="text-center" variant="sectionTitle">
            {loadingOverlay.label}
          </AppText>
          {loadingOverlay.detail ? (
            <AppText className="text-center" variant="bodyMuted">
              {loadingOverlay.detail}
            </AppText>
          ) : null}
        </FormSurface>
      </View>
    </>
  ) : null;

  return (
    <>
      {/* `pointerEvents="auto"`: a loader is meant to block interaction with the app behind it. */}
      <OverlayPortal
        animationType="fade"
        pointerEvents="auto"
        visible={!!loadingOverlay}
      >
        {loadingBody}
      </OverlayPortal>
      <AppToastHost toast={state.toast} />
    </>
  );
}

function AppToastHost({ toast }: { toast: AppToastState | null }) {
  // Keep the last toast message rendered through the exit animation so it
  // doesn't pop out abruptly when the controller clears state.toast. The
  // animation lifecycle itself is handled by PopoverTransition.
  const [rendered, setRendered] = useState<AppToastState | null>(toast);
  const clearRendered = useCallback(() => setRendered(null), []);

  useEffect(() => {
    if (toast) setRendered(toast);
  }, [toast]);

  return (
    // Portaled so the toast is viewport-fixed and above all page content; box-none + the inner
    // pointerEvents="none" keep it click-through. Stays mounted via `rendered` until the exit
    // animation completes, then OverlayPortal unmounts. `decorative`: a toast is a pure
    // decoration — it must not be a back target, collapse the assistant, or own modal a11y.
    <OverlayPortal decorative visible={!!rendered}>
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center px-app-md"
      >
        <PopoverTransition visible={!!toast} onExitComplete={clearRendered}>
          <FormSurface
            className="max-w-[360px] border-border-strong"
            motion="none"
            padding="sm"
            tone="raised"
          >
            <AppText className="text-center" variant="label">
              {rendered?.message ?? ""}
            </AppText>
          </FormSurface>
        </PopoverTransition>
      </View>
    </OverlayPortal>
  );
}
