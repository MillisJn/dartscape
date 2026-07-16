import { Pressable, View, type ViewStyle } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { TooltipBubble } from "@spatch-kit/ui/overlays/tooltip/TooltipBubble";
import { useTooltipAnchor } from "@spatch-kit/ui/overlays/tooltip/useTooltipAnchor";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import {
  ButtonFocusRing,
  useButtonPressRing,
} from "@spatch-kit/ui/primitives/buttonPressRing";

type FloatingActionButtonProps = {
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  rightOffset?: number;
  bottomOffset?: number;
  // Horizontally centre the button (bottom tab bar's raised create action) instead of pinning it to
  // the right edge. `rightOffset` is ignored when set.
  centered?: boolean;
  // Face shape: "circle" (default) or a "square" (rounded-corner) for the raised center action.
  shape?: "circle" | "square";
};

// Drop shadow that lifts the FAB on BOTH web and native. boxShadow — NOT elevation: on Android an
// `elevation` shadow raises the button in the z-buffer above overlays (the reason the FAB moved off
// elevation), and it can't fade with an animated surface. boxShadow paints into the view, composites
// correctly, and RN 0.85 renders it natively — so one value works everywhere. A moderate button-weight
// lift: a soft ambient layer plus a tight contact layer.
const FAB_SHADOW: Record<"light" | "dark", string> = {
  light:
    "0px 6px 16px rgba(21, 32, 51, 0.16), 0px 2px 5px rgba(21, 32, 51, 0.12)",
  dark: "0px 8px 20px rgba(0, 0, 0, 0.5), 0px 2px 6px rgba(0, 0, 0, 0.4)",
};

// A circular floating action button that presses like a real (secondary) button: it shares the exact
// focus-ring press animation with ButtonSurface (useButtonPressRing + ButtonFocusRing) and adds a
// cross-platform drop shadow. Keeps the secondary look — a bordered raised surface.
export function FloatingActionButton({
  accessibilityLabel,
  icon,
  onPress,
  disabled = false,
  rightOffset,
  bottomOffset,
  centered = false,
  shape = "circle",
}: FloatingActionButtonProps) {
  const theme = useTheme();
  const {
    ref: fabRef,
    visible,
    onHoverIn,
    onHoverOut,
  } = useTooltipAnchor(accessibilityLabel, !disabled);
  const ring = useButtonPressRing({ expand: 8 });

  const shadowStyle = {
    boxShadow: FAB_SHADOW[theme.appearance === "dark" ? "dark" : "light"],
  } as unknown as ViewStyle;

  const radiusClass = shape === "square" ? "rounded-app-lg" : "rounded-app-pill";

  return (
    <View
      // Centred: span the parent and let flex centre the face. The previous `left: "50%"` + a
      // translateX of half a HARD-CODED size only lands on centre while that constant exactly equals
      // the rendered width — any drift (a face size change, a scaled unit) silently shifts the button
      // off-centre by half the difference, with nothing to catch it. Measuring nothing and letting
      // layout do it is self-correcting.
      // box-none while centred: the wrapper now spans the full width, so it must not swallow the taps
      // of the tabs it sits over — only the button itself takes touches.
      pointerEvents={centered ? "box-none" : "auto"}
      style={{
        bottom: bottomOffset ?? theme.space.lg,
        position: "absolute",
        zIndex: 30,
        ...(centered
          ? { alignItems: "center", left: 0, right: 0 }
          : { right: rightOffset ?? theme.space.md }),
      }}
    >
      <Pressable
        ref={fabRef}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onHoverIn={() => {
          if (disabled) return;
          onHoverIn();
          ring.onHoverIn();
        }}
        onHoverOut={() => {
          onHoverOut();
          ring.onHoverOut();
        }}
        onPress={onPress}
        onPressIn={() => {
          if (disabled) return;
          ring.onPressIn();
        }}
        onPressOut={() => {
          if (disabled) return;
          ring.onPressOut();
        }}
        // No overflow-hidden, so both the focus ring and the boxShadow can sit outside the face edge.
        className={`h-16 w-16 items-center justify-center ${radiusClass} border border-border-strong bg-surface-raised`}
        style={[{ opacity: disabled ? 0.45 : 1 }, shadowStyle]}
      >
        <ButtonFocusRing
          className={radiusClass}
          inset={ring.ringInset}
          opacity={ring.ringOpacity}
          borderWidth={3}
        />
        <AppIcon name={icon} color={theme.colors.text} size={24} />
        <TooltipBubble
          anchorRef={fabRef}
          label={accessibilityLabel}
          placement="top"
          visible={visible}
        />
      </Pressable>
    </View>
  );
}
