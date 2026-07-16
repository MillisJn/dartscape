import { type ComponentProps, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { TooltipBubble } from "@spatch-kit/ui/overlays/tooltip/TooltipBubble";
import { useTooltipAnchor } from "@spatch-kit/ui/overlays/tooltip/useTooltipAnchor";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import {
  ButtonFocusRing,
  useButtonPressRing,
} from "@spatch-kit/ui/primitives/buttonPressRing";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonDepth = "raised" | "inset" | "flat";
type ButtonShape = "full" | "left" | "middle" | "right";
type ButtonLayout = "row" | "stacked";

type ButtonProps = PropsWithChildren<{
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  // While loading, the label is replaced by a spinner and the button is inert (disabled), but it
  // keeps its accessible name and announces `busy` — see ButtonSurface.
  loading?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  className?: string;
  style?: StyleProp<ViewStyle>;
  textClassName?: string;
  textStyle?: StyleProp<TextStyle>;
}>;

type ButtonSurfaceProps = PropsWithChildren<{
  accessibilityLabel?: string;
  accessibilityRole?: ComponentProps<typeof Pressable>["accessibilityRole"];
  accessibilityState?: ComponentProps<typeof Pressable>["accessibilityState"];
  className?: string;
  depth?: ButtonDepth;
  disabled?: boolean;
  faceClassName?: string;
  faceStyle?: StyleProp<ViewStyle>;
  // Render only the leading icon, centered (no label) — for compact toolbars. Pair with
  // accessibilityLabel so the action stays reachable by screen readers.
  iconOnly?: boolean;
  layout?: ButtonLayout;
  leadingIcon?: IconName;
  // Swap the label/icons for a centered spinner and make the surface inert while a slow action (e.g.
  // a save) is in flight. Keeps the accessible name and sets accessibilityState.busy.
  loading?: boolean;
  minHeight?: number;
  onPress?: () => void;
  shellColor?: string;
  showFaceEdges?: boolean;
  showShellOutline?: boolean;
  showShadow?: boolean;
  shape?: ButtonShape;
  style?: StyleProp<ViewStyle>;
  textClassName?: string;
  textStyle?: StyleProp<TextStyle>;
  // Suppress the icon-only hover tooltip (which otherwise shows accessibilityLabel on web).
  tooltipDisabled?: boolean;
  trailingIcon?: IconName;
  variant?: ButtonVariant;
}>;

function getShapeClassName(shape: ButtonShape) {
  switch (shape) {
    case "left":
      return "rounded-l-app-sm";
    case "right":
      return "rounded-r-app-sm";
    case "middle":
      return "rounded-none";
    default:
      return "rounded-app-sm";
  }
}

function getPalette(variant: ButtonVariant) {
  switch (variant) {
    case "primary":
      return {
        faceClassName: "bg-accent",
        faceEdgeClassName: "border border-white/10",
        iconColorKey: "accentContrast" as const,

        textColorKey: "accentContrast" as const,
      };
    case "ghost":
      return {
        faceClassName: "bg-surface",
        faceEdgeClassName: "border border-border-strong",
        iconColorKey: "text" as const,
        shellClassName: "bg-border/70",
        textColorKey: "text" as const,
      };
    case "danger":
      return {
        faceClassName: "bg-surface-raised",
        faceEdgeClassName: "border border-border",
        iconColorKey: "danger" as const,
        shellClassName: "bg-transparent",
        textColorKey: "danger" as const,
      };
    default:
      // Secondary (e.g. Cancel): a stronger border than the faint `border` token so the outline
      // reads clearly against the surface — it was barely visible before.
      return {
        faceClassName: "bg-surface-raised",
        faceEdgeClassName: "border border-border-strong",
        iconColorKey: "accent" as const,
        shellClassName: "bg-transparent",
        textColorKey: "accent" as const,
      };
  }
}

export function ButtonSurface({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  className,
  depth = "raised",
  disabled = false,
  faceClassName,
  faceStyle,
  iconOnly = false,
  layout = "row",
  leadingIcon,
  loading = false,
  minHeight = 52,
  onPress,
  shellColor,
  showFaceEdges = true,
  showShellOutline = true,
  showShadow = false,
  shape = "full",
  style,
  textClassName,
  textStyle,
  tooltipDisabled = false,
  trailingIcon,
  variant = "secondary",
}: ButtonSurfaceProps) {
  const theme = useTheme();
  const palette = getPalette(variant);
  // `loading` makes the button inert (like disabled) so it can't be pressed again mid-action, but it
  // reads as "busy", not "disabled", to assistive tech — the action is in progress, not unavailable.
  const isInert = disabled || loading;
  // Shared focus-ring press animation (identical to the FAB — see buttonPressRing).
  const ring = useButtonPressRing();
  // RN does NOT expose a Pressable's text children as its accessible name (unlike HTML <button>), so
  // derive the label from a string child when the caller didn't pass one — this gives every text
  // button an aria-label / screen-reader name for free. Explicit props always win. Default the role to
  // "button" unless the caller set another (e.g. "tab"/"radio").
  const derivedLabel =
    accessibilityLabel ??
    (!iconOnly && typeof children === "string" ? children : undefined);
  const resolvedRole = accessibilityRole ?? "button";
  // Icon-only buttons carry no visible text, so surface their label as a hover tooltip on web
  // (centrally covers every iconOnly ButtonSurface — e.g. the area-editor toolbar).
  const tooltipLabel = iconOnly ? derivedLabel : undefined;
  const {
    ref: tooltipRef,
    visible: tooltipVisible,
    onHoverIn: tooltipHoverIn,
    onHoverOut: tooltipHoverOut,
  } = useTooltipAnchor(tooltipLabel, !isInert && !tooltipDisabled);
  // Keep any caller-provided state, but layer on the inert/busy semantics: `busy` while loading so
  // screen readers announce "in progress", and `disabled` whenever the surface is non-interactive.
  const resolvedAccessibilityState = {
    ...accessibilityState,
    busy: loading || accessibilityState?.busy,
    disabled: isInert || accessibilityState?.disabled,
  };
  const shapeClassName = getShapeClassName(shape);
  // boxShadow on BOTH platforms (RN 0.85 renders it natively): a shadowed button often rides a
  // translating scene (tab carousel / record push), and an Android `elevation` shadow reprojects
  // every frame of that slide. boxShadow is painted into the view, so it doesn't.
  const shadowStyle: ViewStyle = showShadow
    ? {
        boxShadow:
          variant === "primary"
            ? "0px 10px 24px rgba(31, 38, 31, 0.12), 0px 2px 6px rgba(31, 38, 31, 0.08)"
            : "0px 6px 18px rgba(31, 38, 31, 0.08)",
      }
    : {};

  return (
    <View className={className} style={style}>
      <Pressable
        ref={tooltipRef}
        accessibilityLabel={derivedLabel}
        accessibilityRole={resolvedRole}
        accessibilityState={resolvedAccessibilityState}
        className={[
          "w-full",
          shapeClassName,
          isInert ? "opacity-55" : "",
        ].join(" ")}
        disabled={isInert}
        onHoverIn={() => {
          if (isInert) return;
          tooltipHoverIn();
          ring.onHoverIn();
        }}
        onHoverOut={() => {
          if (isInert) return;
          tooltipHoverOut();
          ring.onHoverOut();
        }}
        onPress={onPress}
        onPressIn={ring.onPressIn}
        onPressOut={ring.onPressOut}
      >
        <View
          className={[
            "p-px",
            shapeClassName,
            showShellOutline
              ? shellColor
                ? ""
                : palette.shellClassName
              : "bg-transparent",
          ].join(" ")}
          style={[
            shadowStyle,
            shellColor ? { backgroundColor: shellColor } : null,
          ]}
        >
          <ButtonFocusRing
            className={shapeClassName}
            inset={ring.ringInset}
            opacity={ring.ringOpacity}
          />
          <View
            className={[
              iconOnly
                ? "w-full flex-row items-center justify-center px-app-xs py-app-xs"
                : layout === "stacked"
                  ? "w-full flex-col items-center justify-center gap-app-xxs px-app-xs py-app-xs"
                  : "w-full flex-row items-center justify-center gap-app-xs px-app-md py-app-sm",
              shapeClassName,
              palette.faceClassName,
              showFaceEdges ? palette.faceEdgeClassName : "border-0",
              faceClassName ?? "",
            ].join(" ")}
            style={[{ minHeight }, faceStyle]}
          >
            {loading ? (
              // Replaces the label/icons while an action is in flight; the accessible name + busy
              // state are already carried by the Pressable, so the spinner needs no label of its own.
              <ActivityIndicator
                color={theme.colors[palette.iconColorKey]}
                size="small"
              />
            ) : null}
            {!loading && leadingIcon ? (
              <AppIcon
                // Inline before the label (row layout, not icon-only) → optically center with the
                // text. Icon-only buttons and the stacked layout (icon above text) center on their
                // own, so no nudge.
                alignText={!iconOnly && layout === "row"}
                color={theme.colors[palette.iconColorKey]}
                name={leadingIcon}
                size={
                  iconOnly
                    ? theme.type.label + 6
                    : layout === "stacked"
                      ? theme.type.caption + 8
                      : theme.type.caption + 4
                }
              />
            ) : null}
            {loading || iconOnly ? null : (
              <AppText
                className={textClassName}
                color={palette.textColorKey}
                ellipsizeMode="tail"
                numberOfLines={1}
                variant={layout === "stacked" ? "caption" : "label"}
                style={[{ flexShrink: 1 }, textStyle]}
              >
                {children}
              </AppText>
            )}
            {!loading && !iconOnly && trailingIcon ? (
              <AppIcon
                alignText={layout === "row"}
                color={theme.colors[palette.iconColorKey]}
                name={trailingIcon}
                size={theme.type.caption + 4}
              />
            ) : null}
          </View>
        </View>
        {tooltipLabel ? (
          <TooltipBubble
            anchorRef={tooltipRef}
            label={tooltipLabel}
            visible={tooltipVisible}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

function ButtonBase({
  children,
  onPress,
  variant = "secondary",
  disabled = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  className,
  style,
  textClassName,
  textStyle,
}: ButtonProps) {
  return (
    <ButtonSurface
      className={className}
      disabled={disabled}
      leadingIcon={leadingIcon}
      loading={loading}
      onPress={onPress}
      showShellOutline={variant !== "secondary"}
      style={style}
      textClassName={textClassName}
      textStyle={textStyle}
      trailingIcon={trailingIcon}
      variant={variant}
    >
      {children}
    </ButtonSurface>
  );
}

// See Screen.tsx's comment — nativewind@4 has no styled(); ButtonBase already declares className/
// style and textClassName/textStyle as independent props and forwards both, so the v2-style
// className->style prop-mapping options are unneeded here.
export const Button = ButtonBase;
