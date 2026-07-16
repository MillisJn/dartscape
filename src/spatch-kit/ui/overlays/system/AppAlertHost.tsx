import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { PopoverTransition } from "@spatch-kit/ui/animated/PopoverTransition";
import { OverlayPortal } from "@spatch-kit/ui/overlays/core/OverlayPortal";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { ButtonSurface, type ButtonVariant } from "@spatch-kit/ui/primitives/Button";
import { deferPastCommit } from "@spatch-kit/ui/utils/deferPastCommit";

import {
  dismissAppAlert,
  getAppAlertState,
  pressAppAlertButton,
  subscribeAppAlert,
  type AppAlertButton,
  type AppAlertState,
} from "./appAlertController";
import { useOverlayRegistration } from "../core/dismissal";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AppAlertHost() {
  const [state, setState] = useState(getAppAlertState);

  useEffect(() => subscribeAppAlert(setState), []);

  // Keep the last alert mounted through the exit animation so it fades out
  // smoothly when the controller advances the queue (mirrors AppToastHost).
  const [rendered, setRendered] = useState<AppAlertState | null>(state);
  const clearRendered = useCallback(() => setRendered(null), []);

  useEffect(() => {
    if (state) setRendered(state);
  }, [state]);

  const visible = !!state;

  const dismiss = useCallback(() => {
    if (state) dismissAppAlert(state.id);
  }, [state]);

  // Hardware back gesture / single-active-overlay coordination. Only registers
  // a dismiss handler while the alert is cancelable.
  useOverlayRegistration(visible && (state?.cancelable ?? true), dismiss);

  // Gate the entrance animation until the overlay is actually on screen. On
  // native the Modal needs a frame to present; starting the fast fade-in before
  // it finishes means the user never sees it (and the backdrop appears to pop).
  // Modal.onShow fires once presented; on web there's no present delay so a
  // post-mount effect flips it. Reset when the overlay tears down so the next
  // alert animates in fresh.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!rendered) {
      setReady(false);
    } else if (Platform.OS === "web") {
      setReady(true);
    }
  }, [rendered]);

  if (!rendered) return null;

  const body = (
    <AppAlertBody
      alert={rendered}
      visible={visible && ready}
      onDismiss={dismiss}
      onExitComplete={clearRendered}
    />
  );

  return (
    // Stays mounted (visible) until the exit animation finishes and `rendered` clears;
    // PopoverTransition drives the fade. `active={visible}` (the live `!!state` intent) flips the
    // layer non-interactive the instant the alert is dismissed, so back targeting / "has overlay"
    // ignore it while it fades out. onShow gates the entrance on native; web uses the `ready` effect.
    <OverlayPortal
      active={visible}
      animationType="none"
      visible
      onRequestClose={dismiss}
      onShow={() => setReady(true)}
    >
      {body}
    </OverlayPortal>
  );
}

function AppAlertBody({
  alert,
  visible,
  onDismiss,
  onExitComplete,
}: {
  alert: AppAlertState;
  visible: boolean;
  onDismiss: () => void;
  onExitComplete: () => void;
}) {
  const theme = useTheme();

  // Type-to-confirm: when the alert requires an input phrase, keep the non-cancel buttons
  // disabled until the typed value matches (case-insensitive, trimmed).
  const [typed, setTyped] = useState("");
  const requireInput = alert.requireInput;
  const confirmEnabled =
    !requireInput ||
    typed.trim().toLowerCase() === requireInput.confirmText.trim().toLowerCase();

  // Deferred autofocus for the type-to-confirm input — NOT RN's native `autoFocus`. On native
  // (Fabric), focusing a TextInput as it attaches fires showSoftInput → focusSearch →
  // FabricUIManager.findNextFocusableElement, which use-after-frees while the view tree is still
  // mounting and aborts the process natively ("Scudo invalid chunk state"). Focus after the mount
  // commit/paint settle so the search walks a stable tree; web keeps immediate focus.
  const inputRef = useRef<TextInput | null>(null);
  useEffect(() => {
    if (!requireInput || !visible) return;
    if (Platform.OS === "web") {
      inputRef.current?.focus();
      return;
    }
    return deferPastCommit(() => {
      inputRef.current?.focus();
    });
  }, [requireInput, visible]);

  // `visible` is gated by the host's `ready` flag, so the card/backdrop mount
  // hidden and animate in only once the overlay is actually on screen — the same
  // fade + spring-scale lifecycle the assistant popover and toast get for free.
  const shown = visible;

  // PopoverTransition fires onExitComplete when it mounts in the hidden state
  // (immediately under reduced motion). Ignore that until the alert has actually
  // been shown, so the spurious mount-time exit can't clear it before it opens.
  const hasShownRef = useRef(false);
  useEffect(() => {
    if (shown) hasShownRef.current = true;
  }, [shown]);
  const handleExitComplete = useCallback(() => {
    if (hasShownRef.current) onExitComplete();
  }, [onExitComplete]);

  // Fade the dim backdrop in/out. Enter is gated on `backdropReady` (invariant #2 — see
  // useOverlayPresence / PopoverTransition): the fade-in starts only AFTER the backdrop has committed
  // on screen, so it never flashes/pops on the first frame. Exit runs immediately when hidden.
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [backdropReady, setBackdropReady] = useState(false);
  useEffect(() => {
    if (shown) setBackdropReady(true);
  }, [shown]);
  useEffect(() => {
    if (!theme.motion.enabled) {
      backdropOpacity.setValue(shown ? 1 : 0);
      return;
    }
    // Wait for a committed frame before fading in (never animate before the view paints).
    if (shown && !backdropReady) {
      return;
    }
    const anim = Animated.timing(backdropOpacity, {
      toValue: shown ? 1 : 0,
      duration: shown
        ? theme.motion.duration.fast
        : theme.motion.duration.normal,
      easing: shown ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      // Native driver on native (UI thread → smooth entrance while content mounts), JS on web.
      useNativeDriver: Platform.OS !== "web",
    });
    anim.start();
    return () => anim.stop();
  }, [
    shown,
    backdropReady,
    backdropOpacity,
    theme.motion.enabled,
    theme.motion.duration.fast,
    theme.motion.duration.normal,
  ]);

  return (
    <View className="absolute inset-0 items-center justify-center px-app-md">
      {/* Dimmed backdrop. Tapping dismisses only when cancelable. */}
      <AnimatedPressable
        className="absolute inset-0"
        style={{
          backgroundColor: theme.colors.surfaceOverlay,
          opacity: backdropOpacity,
        }}
        onPress={alert.cancelable ? onDismiss : undefined}
        disabled={!alert.cancelable}
      />
      {/* The card's surface + shadow live on the PopoverTransition animated node
          (not a nested FormSurface) so the shadow fades with the opacity on exit
          instead of lingering — same approach as the assistant popover. */}
      <PopoverTransition
        visible={shown}
        onExitComplete={handleExitComplete}
        className="w-full max-w-[360px] gap-app-sm rounded-app-lg border border-border bg-surface p-app-lg"
        // Inline duplicate of the visual classes: on web NativeWind doesn't apply className styles
        // through the styled-Animated PopoverTransition, so without this the alert card renders
        // transparent/square. Native uses the classes (same values).
        style={{
          // boxShadow (NOT elevation) so the shadow fades with the card and never flickers a map
          // underneath — see theme.shadow.overlay / PopoverTransition invariants.
          boxShadow: theme.shadow.overlay.boxShadow,
          width: "100%",
          maxWidth: 360,
          gap: theme.space.sm,
          borderRadius: theme.radius.lg,
          borderWidth: theme.borderWidth.sm,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: theme.space.lg,
        }}
      >
        <AppText variant="sectionTitle">{alert.title}</AppText>
        {alert.message ? (
          <AppText variant="bodyMuted">{alert.message}</AppText>
        ) : null}
        {requireInput ? (
          <TextInput
            ref={inputRef}
            value={typed}
            onChangeText={setTyped}
            placeholder={requireInput.placeholder ?? requireInput.confirmText}
            placeholderTextColor={theme.colors.mutedText}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              marginTop: theme.space.xs,
              borderWidth: theme.borderWidth.sm,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.sm,
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
        ) : null}
        <AppAlertButtons alert={alert} confirmEnabled={confirmEnabled} />
      </PopoverTransition>
    </View>
  );
}

function AppAlertButtons({
  alert,
  confirmEnabled,
}: {
  alert: AppAlertState;
  confirmEnabled: boolean;
}) {
  // Preserve original indices for press routing while controlling display order.
  const indexed = alert.buttons.map((button, index) => ({ button, index }));
  // Side-by-side for two buttons; stacked for three or more. When stacked,
  // float cancel buttons to the bottom (iOS convention); side-by-side keeps the
  // author's order (typically [Cancel, Action] → cancel on the left).
  const stacked = indexed.length > 2;
  const ordered = stacked
    ? [...indexed].sort(
        (a, b) =>
          Number(a.button.style === "cancel") -
          Number(b.button.style === "cancel"),
      )
    : indexed;

  return (
    <View
      className={
        stacked
          ? "mt-app-xs gap-app-sm"
          : "mt-app-xs flex-row gap-app-sm"
      }
    >
      {ordered.map(({ button, index }) => (
        <AppAlertButton
          key={index}
          button={button}
          fill={!stacked}
          // Type-to-confirm gates every non-cancel action until the phrase matches.
          disabled={!confirmEnabled && button.style !== "cancel"}
          onPress={() => pressAppAlertButton(alert.id, index)}
        />
      ))}
    </View>
  );
}

function AppAlertButton({
  button,
  fill,
  disabled,
  onPress,
}: {
  button: AppAlertButton;
  fill: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const style = button.style ?? "default";
  const variant: ButtonVariant =
    style === "cancel" ? "secondary" : style === "destructive" ? "danger" : "primary";

  return (
    <ButtonSurface
      className={fill ? "flex-1" : undefined}
      onPress={onPress}
      variant={variant}
      disabled={disabled}
    >
      {button.text}
    </ButtonSurface>
  );
}
