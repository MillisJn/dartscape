import type { ReactNode } from "react";
import { View } from "react-native";

import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText, type TextVariant } from "@spatch-kit/ui/primitives/AppText";

type SectionHeaderProps = {
  title: string;
  icon?: IconName;
  // Header actions (chevron / menu / add+delete), rendered at the trailing edge.
  trailing?: ReactNode;
  // Sections use "sectionTitle" (19px); entity heroes can opt into "title" (26px).
  titleVariant?: TextVariant;
  // Drop the bottom divider (rare — most sections want it for a uniform bar).
  borderless?: boolean;
  // Explicit header fill. Card sections inherit the surface behind them (leave undefined); flat
  // "list" sections pass a muted color so the header reads as a distinct strip above the rows.
  backgroundColor?: string;
};

// The single header bar shared by every section type (field, single-relation,
// multi-relation, overview). A fixed-height row with a bottom border so every
// section title looks identical regardless of its trailing controls. Designed to
// sit at the top of a `padding="none"` surface (see SectionSurface).
export function SectionHeader({
  title,
  icon,
  trailing,
  titleVariant = "sectionTitle",
  borderless = false,
  backgroundColor,
}: SectionHeaderProps) {
  return (
    <View
      className={[
        "h-[52px] flex-row items-center justify-between gap-app-sm px-app-md",
        borderless ? "" : "border-b border-border",
      ]
        .filter(Boolean)
        .join(" ")}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <View className="flex-row shrink items-center gap-app-xs">
        {icon ? <AppIcon alignText name={icon} size={18} /> : null}
        <AppText className="shrink" numberOfLines={1} variant={titleVariant}>
          {title}
        </AppText>
      </View>
      {trailing}
    </View>
  );
}
