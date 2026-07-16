import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useLayoutMode } from "@spatch-kit/ui/responsive/useLayoutMode";
import { useNavigationSurfaceProps } from "@spatch-kit/ui/utils/navigation";

export type ScreenContentWidth = "default" | "wide" | "full";

const CONTENT_MAX_WIDTH: Record<Exclude<ScreenContentWidth, "full">, number> = {
  default: 840,
  wide: 1100,
};

type ScreenProps = PropsWithChildren<{
  className?: string;
  // On large screens the content is capped and centered so it doesn't stretch
  // edge-to-edge. "full" opts out for full-bleed screens (e.g. Maps).
  contentWidth?: ScreenContentWidth;
  style?: StyleProp<ViewStyle>;
}>;

function ScreenBase({
  children,
  className,
  contentWidth = "default",
  style,
}: ScreenProps) {
  const navigationSurfaceProps = useNavigationSurfaceProps();
  const { isExpanded } = useLayoutMode();

  // Below 768px (and for "full" screens) the centering wrapper is skipped
  // entirely — zero behavior change on phones.
  const centered = isExpanded && contentWidth !== "full";

  return (
    // No `bg-background` here: the page color is already painted by the scene (tab sceneStyle) or
    // the native-stack contentStyle directly behind every screen — repainting it here just stacked
    // another full-screen opaque layer on every screen (overdraw). Transparent = the same color
    // shows through, one paint instead of two.
    <View
      className={["flex-1", className].filter(Boolean).join(" ")}
      {...navigationSurfaceProps}
      style={[style]}
    >
      {centered ? (
        <View
          className="w-full flex-1 self-center"
          style={{ maxWidth: CONTENT_MAX_WIDTH[contentWidth] }}
        >
          {children}
        </View>
      ) : (
        children
      )}
    </View>
  );
}

// nativewind@4 has no `styled()` (it was a v2 API) — ScreenBase already forwards `className` to
// an inner host View, which v4 handles natively, so the wrapper was a no-op. Direct export instead.
export const Screen = ScreenBase;
