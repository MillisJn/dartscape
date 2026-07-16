import { type PropsWithChildren, type RefObject } from "react";
import { type View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AnchoredOverlay } from "@spatch-kit/ui/overlays/anchored/AnchoredOverlay";
import { FormSurface } from "@spatch-kit/ui/primitives/FormSurface";

type DropdownSurfaceProps = PropsWithChildren<{
  anchorRef: RefObject<View | null>;
  // Which edge of the panel aligns to the anchor. Defaults to "start" (left) — the field-width
  // dropdown. "end" right-aligns it, for anchoring to a trailing trigger like a card's link icon.
  align?: "start" | "end";
  maxHeight?: number;
  onClose?: () => void;
  visible: boolean;
  // When set, the panel uses this fixed width (positioned per `align`) instead of matching the
  // anchor's width — for anchoring to a small trigger (e.g. a card's link icon) while still giving
  // the dropdown a usable width. When omitted, the panel matches the anchor's width.
  width?: number;
}>;

const noop = () => {};

// A field dropdown anchored under its trigger. Renders through AnchoredOverlay so on web it
// escapes ancestor transforms/stacking contexts (it would otherwise be clipped by an
// `overflow:hidden` parent or buried by a sibling's stacking context) while still sitting
// directly beneath the field at its measured position and width.
export function DropdownSurface({
  anchorRef,
  align = "start",
  children,
  maxHeight,
  onClose,
  visible,
  width,
}: DropdownSurfaceProps) {
  const theme = useTheme();
  const resolvedMaxHeight = maxHeight ?? 360;

  return (
    <AnchoredOverlay
      visible={visible}
      anchorRef={anchorRef}
      onClose={onClose ?? noop}
      align={align}
      matchAnchorWidth={width == null}
      // Field dropdowns are non-modal on web: the page scrolls under them (wheel over the page) and
      // an outside click / page scroll closes them — like a native desktop select. On native this
      // collapses to the blocking backdrop.
      dismissMode="page-scroll"
    >
      <FormSurface
        motion="none"
        padding="none"
        tone="raised"
        // boxShadow (NOT elevation) so the shadow fades with the dropdown's opacity and never makes
        // a map underneath flicker — see theme.shadow.overlay / PopoverTransition invariants.
        style={{
          boxShadow: theme.shadow.overlay.boxShadow,
          maxHeight: resolvedMaxHeight,
          ...(width == null ? null : { width }),
        }}
      >
        {children}
      </FormSurface>
    </AnchoredOverlay>
  );
}
