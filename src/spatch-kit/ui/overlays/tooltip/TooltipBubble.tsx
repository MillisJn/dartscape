import { useState, type RefObject } from "react";
import {
  Animated,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
  type View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";

import { OverlayPortal } from "../core/OverlayPortal";
import { useOverlayPresence } from "../core/useOverlayPresence";
import { useAnchorRect } from "../anchored/useAnchorRect";

const GUTTER = 8;
const SCREEN_PADDING = 8;
const MAX_WIDTH = 260;

// Web-only tooltip bubble. It teleports to the top-level OverlayPortal (so it's never clipped by an
// ancestor overflow/transform), measures its anchor with useAnchorRect, and positions itself
// centered over the anchor — above by default, flipping below when there's no room up top. The
// bubble is pointer-transparent (never blocks the button's own hover/click) and hidden from screen
// readers (the anchor already carries the accessibilityLabel, so announcing the bubble would double
// up). Rendering/gating lives here: it no-ops on native and when the "Show tooltips" preference is
// off.
export function TooltipBubble({
  anchorRef,
  label,
  visible,
  placement = "top",
}: {
  anchorRef: RefObject<View | null>;
  label: string;
  visible: boolean;
  // "top"/"bottom" center horizontally over the anchor; "left"/"right" center vertically beside it
  // (e.g. a collapsed left-rail nav item). Each flips to the opposite side when there's no room.
  placement?: "top" | "bottom" | "left" | "right";
}) {
  const theme = useTheme();
  const active = Platform.OS === "web" && theme.showTooltips && visible;
  const { mounted, contentOpacity } = useOverlayPresence(active);
  const rect = useAnchorRect(anchorRef, mounted);
  const window = useWindowDimensions();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  if (!mounted) {
    return null;
  }

  // Hold the bubble invisible until BOTH the anchor rect and the bubble's own measured size are
  // known — otherwise it flashes at the top-left corner for a frame before it can be placed.
  let placementStyle: ViewStyle;
  if (rect && size) {
    const clampAxis = (raw: number, extent: number, viewport: number) =>
      Math.min(Math.max(raw, SCREEN_PADDING), Math.max(SCREEN_PADDING, viewport - extent - SCREEN_PADDING));

    if (placement === "left" || placement === "right") {
      // Vertically centered on the anchor; to the side, flipping when the chosen side won't fit.
      const top = clampAxis(rect.y + rect.height / 2 - size.h / 2, size.h, window.height);
      const rightLeft = rect.x + rect.width + GUTTER;
      const leftLeft = rect.x - GUTTER - size.w;
      const fitsRight = rightLeft + size.w <= window.width - SCREEN_PADDING;
      const fitsLeft = leftLeft >= SCREEN_PADDING;
      const left =
        placement === "right"
          ? fitsRight || !fitsLeft
            ? rightLeft
            : leftLeft
          : fitsLeft || !fitsRight
            ? leftLeft
            : rightLeft;
      placementStyle = { position: "absolute", top, left };
    } else {
      // Horizontally centered over the anchor; above by default, flipping below when there's no room.
      const left = clampAxis(rect.x + rect.width / 2 - size.w / 2, size.w, window.width);
      const aboveTop = rect.y - GUTTER - size.h;
      const belowTop = rect.y + rect.height + GUTTER;
      const fitsAbove = aboveTop >= SCREEN_PADDING;
      const fitsBelow = belowTop + size.h <= window.height - SCREEN_PADDING;
      const top =
        placement === "top"
          ? fitsAbove || !fitsBelow
            ? aboveTop
            : belowTop
          : fitsBelow || !fitsAbove
            ? belowTop
            : aboveTop;
      placementStyle = { position: "absolute", top, left };
    }
  } else {
    placementStyle = { position: "absolute", top: 0, left: 0, opacity: 0 };
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width && height && (!size || size.w !== width || size.h !== height)) {
      setSize({ w: width, h: height });
    }
  };

  // aria-hidden isn't in RN's View types; the codebase's convention for web-only DOM props is a cast.
  const webAriaHidden = { "aria-hidden": true } as unknown as Record<string, unknown>;

  return (
    <OverlayPortal active={active} visible={mounted} decorative>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={onLayout}
        pointerEvents="none"
        {...webAriaHidden}
        style={[
          placementStyle,
          {
            maxWidth: MAX_WIDTH,
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: theme.colors.border,
            borderWidth: theme.borderWidth.hairline,
            borderRadius: theme.radius.md,
            paddingVertical: theme.space.xxs,
            paddingHorizontal: theme.space.xs,
            boxShadow: theme.shadow.button.boxShadow,
            opacity: rect && size ? contentOpacity : 0,
          },
        ]}
      >
        <AppText color="text" numberOfLines={2} variant="caption">
          {label}
        </AppText>
      </Animated.View>
    </OverlayPortal>
  );
}
