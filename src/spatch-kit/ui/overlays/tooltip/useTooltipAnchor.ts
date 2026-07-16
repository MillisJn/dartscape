import { useRef } from "react";
import { Platform, type View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";

import { useTooltipState } from "./useTooltipState";

// Attach a hover tooltip to a Pressable you already own (no wrapper element, so layout is untouched).
// Returns a ref to put on the Pressable's host node, the hover handlers to spread, and the `visible`
// flag to feed a <TooltipBubble anchorRef={ref} …>. Prefer <IconButton> for plain icon buttons and
// <Tooltip> for arbitrary children; use this for custom Pressables (a badge bell, a FAB, a toggle)
// where wrapping would disturb layout or fight an existing ref.
//
// `extraEnabled` folds in per-button conditions (e.g. !disabled). The web + preference + has-label
// gate is applied here so callers don't repeat it.
export function useTooltipAnchor(label: string | undefined, extraEnabled = true) {
  const theme = useTheme();
  const ref = useRef<View | null>(null);
  const enabled =
    Platform.OS === "web" && theme.showTooltips && extraEnabled && !!label;
  const { visible, onHoverIn, onHoverOut } = useTooltipState(enabled);
  return { ref, visible, onHoverIn, onHoverOut };
}
