import { forwardRef, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  type ColorValue,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { TooltipBubble } from "@spatch-kit/ui/overlays/tooltip/TooltipBubble";
import { useTooltipAnchor } from "@spatch-kit/ui/overlays/tooltip/useTooltipAnchor";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { animatePressProgress } from "@spatch-kit/ui/primitives/pressMotion";
import { useMergedRef } from "@spatch-kit/ui/primitives/useMergedRef";

const DEFAULT_TARGET = 44;

type IconButtonProps = {
  icon: IconName;
  // Drives BOTH the accessibilityLabel (aria-label on web, screen-reader text on native) and the
  // hover tooltip text. Required — an icon-only button must always be labeled.
  label: string;
  // Receives the press event so callers can stopPropagation() to keep a parent row/card from also
  // reacting (many inline actions rely on this).
  onPress: (event?: GestureResponderEvent) => void;
  // Optional press lifecycle passthroughs (run alongside the built-in press animation). Used when a
  // caller must react at touch-DOWN — e.g. setting a guard before a focused input blurs.
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  // Glyph size. The touch target stays ≥44px regardless.
  size?: number;
  color?: ColorValue;
  // Glyph emphasis when `color` isn't given. "default" → normal text color (the standard for action
  // buttons); "muted" → the desaturated mutedText, only for genuinely secondary/decorative glyphs.
  // An explicit `color` always overrides this.
  tone?: "default" | "muted";
  // "bare" (default): borderless, transparent. "surface": a bordered chip.
  variant?: "bare" | "surface";
  hitSlop?: number;
  tooltipPlacement?: "top" | "bottom";
  // Suppress the tooltip while keeping the accessibility label (e.g. a control whose meaning is
  // already obvious from adjacent text).
  tooltipDisabled?: boolean;
  accessibilityHint?: string;
  accessibilityState?: PressableProps["accessibilityState"];
  style?: StyleProp<ViewStyle>;
};

// The standard icon-only button: a single Pressable wrapping an AppIcon, with a hover tooltip, an
// accessibility label, and the same hover/press micro-animation as ButtonSurface (a soft tint disc
// fades in on hover; the glyph scales down on press). forwardRef because several callers hand the
// button node to a portaled menu as its anchor.
export const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    onPress,
    onPressIn: onPressInProp,
    onPressOut: onPressOutProp,
    disabled = false,
    size,
    color,
    tone = "default",
    variant = "bare",
    hitSlop = 8,
    tooltipPlacement,
    tooltipDisabled = false,
    accessibilityHint,
    accessibilityState,
    style,
  },
  forwardedRef,
) {
  const theme = useTheme();
  const {
    ref: localRef,
    visible,
    onHoverIn,
    onHoverOut,
  } = useTooltipAnchor(label, !disabled && !tooltipDisabled);
  const setRef = useMergedRef<View>(forwardedRef, localRef);

  const reducedMotion = theme.motion.preference === "reduced";
  const hoverProgress = useRef(new Animated.Value(0)).current;
  const pressProgress = useRef(new Animated.Value(0)).current;

  const tintOpacity = Animated.add(hoverProgress, pressProgress).interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const glyphScale = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  // Translucent so the hover chip reads on any background (a card, a toolbar, a scrim) rather than
  // only against the base surface.
  const tintColor = theme.colors.accentMuted;

  const animate = (value: Animated.Value, toValue: number) =>
    animatePressProgress(
      value,
      toValue,
      reducedMotion,
      theme.motion.duration.fast,
      theme.motion.duration.normal,
    );

  const containerStyle: ViewStyle =
    variant === "surface"
      ? {
          minWidth: DEFAULT_TARGET,
          minHeight: DEFAULT_TARGET,
          paddingHorizontal: theme.space.xs,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface,
        }
      : {
          width: DEFAULT_TARGET,
          height: DEFAULT_TARGET,
          alignItems: "center",
          justifyContent: "center",
        };

  // Web-only pointer cursor; RN's types omit `cursor`, so cast (matches the codebase convention).
  const webCursor =
    Platform.OS === "web"
      ? ({ cursor: disabled ? "default" : "pointer" } as unknown as ViewStyle)
      : null;

  return (
    <Pressable
      ref={setRef}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onHoverIn={() => {
        if (disabled) return;
        onHoverIn();
        animate(hoverProgress, 1);
      }}
      onHoverOut={() => {
        onHoverOut();
        animate(hoverProgress, 0);
      }}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        if (disabled) return;
        onPressInProp?.();
        animate(pressProgress, 1);
      }}
      onPressOut={() => {
        if (disabled) return;
        onPressOutProp?.();
        animate(pressProgress, 0);
      }}
      style={[
        containerStyle,
        disabled ? { opacity: 0.4 } : null,
        webCursor,
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 9999,
          backgroundColor: tintColor,
          opacity: tintOpacity,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{ transform: [{ scale: glyphScale }] }}
      >
        <AppIcon
          color={
            color ??
            (tone === "muted" ? theme.colors.mutedText : theme.colors.text)
          }
          name={icon}
          size={size ?? theme.type.label + 4}
        />
      </Animated.View>
      <TooltipBubble
        anchorRef={localRef}
        label={label}
        placement={tooltipPlacement}
        visible={visible}
      />
    </Pressable>
  );
});
