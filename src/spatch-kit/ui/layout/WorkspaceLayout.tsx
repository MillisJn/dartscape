import { useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";

// The canonical desktop record page: an optional full-width header (highlights bar)
// above a left identity rail + a primary work column, with an optional full-width
// footer spanning under BOTH columns (where the relation tab strip lives). Pure
// layout — it places the already-rendered region nodes and never renders domain
// content itself, so the "descriptors place, blocks render" invariant holds.
//
// Container-aware, NOT window-aware: it measures its own width and only splits into
// two columns when there is genuinely room. That keeps it correct in every context —
// the full-screen record route, a wide master-detail pane, or a narrow inspector —
// without the caller needing to know the available width. Below the threshold it
// stacks (identity then primary then footer), which reads like the phone layout.
const TWO_COLUMN_MIN_WIDTH = 900;
const WIDE_RAIL_MIN_WIDTH = 1200;
const RAIL_WIDTH_WIDE = 360;
const RAIL_WIDTH_NARROW = 300;

type WorkspaceLayoutProps = {
  // Full-width highlights bar (title, status chips, primary actions). Optional —
  // auto-derived workspaces omit it and let the identity rail lead.
  header?: ReactNode;
  // Left rail: identity/overview/linked-record blocks. A fragment of card nodes.
  identity?: ReactNode;
  // Main work column. A fragment of card nodes.
  primary: ReactNode;
  // Full-width region under BOTH columns — e.g. a tab strip of related items, which reads better
  // spanning the whole bottom than boxed into the primary column. Optional.
  footer?: ReactNode;
};

export function WorkspaceLayout({
  header,
  identity,
  primary,
  footer,
}: WorkspaceLayoutProps) {
  const [width, setWidth] = useState<number | null>(null);

  function handleLayout(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width;
    // Ignore sub-pixel jitter so we don't thrash the two-column decision on resize.
    setWidth((current) =>
      current != null && Math.abs(current - next) < 1 ? current : next,
    );
  }

  const measured = width != null;
  const twoColumn = measured && width >= TWO_COLUMN_MIN_WIDTH && identity != null;
  const railWidth =
    measured && width >= WIDE_RAIL_MIN_WIDTH
      ? RAIL_WIDTH_WIDE
      : RAIL_WIDTH_NARROW;

  return (
    <View
      className="w-full gap-app-md"
      onLayout={handleLayout}
      // Until the container width is measured we can't tell one vs two columns, so the first frame
      // would otherwise render the stacked (full-width) layout and then snap into two columns — the
      // "cards load fully stretched out before taking their columns" reflow. Render invisibly for
      // that single measuring frame instead; onLayout still fires at opacity 0, so the width lands
      // and we flip straight to the correct layout with no visible reflow.
      style={measured ? undefined : { opacity: 0 }}
    >
      {header != null ? <View>{header}</View> : null}

      {twoColumn ? (
        <View className="flex-row gap-app-md">
          <View className="gap-app-xxs" style={{ width: railWidth }}>
            {identity}
          </View>
          <View className="min-w-0 flex-1 gap-app-xxs">{primary}</View>
        </View>
      ) : (
        <View className="gap-app-xxs">
          {identity}
          {primary}
        </View>
      )}

      {footer != null ? <View className="gap-app-xxs">{footer}</View> : null}
    </View>
  );
}
