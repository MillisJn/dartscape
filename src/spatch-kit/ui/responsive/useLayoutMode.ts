import { useWindowDimensions } from "react-native";

// Two thresholds, two concerns:
//   tablet (768)  → the bottom tab bar gives way to the side rail/sidebar.
//   desktop (1024) → there is room for a master-detail two-pane.
// They match Tailwind's default `md`/`lg` so JS branches here agree with any
// `md:`/`lg:` utility classes used for pure styling.
export const LAYOUT_BREAKPOINTS = { tablet: 768, desktop: 1024 } as const;

export type LayoutMode = "phone" | "tablet" | "desktop";

export type UseLayoutMode = {
  mode: LayoutMode;
  // >= 768: the expandable sidebar replaces the bottom tab bar.
  isExpanded: boolean;
  // >= 1024: master-detail two-pane is eligible (portrait tablet is too narrow).
  isDesktop: boolean;
  width: number;
};

// Sourced from useWindowDimensions (NOT Dimensions.get) so every consumer
// re-renders on resize — essential for web and Playwright viewport changes.
export function useLayoutMode(): UseLayoutMode {
  const { width } = useWindowDimensions();

  const isDesktop = width >= LAYOUT_BREAKPOINTS.desktop;
  const isExpanded = width >= LAYOUT_BREAKPOINTS.tablet;
  const mode: LayoutMode = isDesktop
    ? "desktop"
    : isExpanded
      ? "tablet"
      : "phone";

  return { isDesktop, isExpanded, mode, width };
}
