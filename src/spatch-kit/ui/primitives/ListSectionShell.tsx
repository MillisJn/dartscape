import type { PropsWithChildren, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import type { IconName } from "@spatch-kit/ui/primitives/AppIcon";
import type { TextVariant } from "@spatch-kit/ui/primitives/AppText";
import { SectionHeader } from "@spatch-kit/ui/primitives/SectionHeader";

type ListSectionShellProps = PropsWithChildren<{
  icon?: IconName;
  // Omit to drop the header strip entirely — the body then sits at the top of the section, inside the
  // same flat chrome (bleed, surface fill, closing borders) as every titled section. For a section
  // whose body already says what it is and would only be repeating itself in a header: the settings
  // hero cards, whose avatar + name IS the identity a header could only label. `icon` and `trailing`
  // live in the header, so they have nothing to attach to and are ignored.
  title?: string;
  titleVariant?: TextVariant;
  trailing?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>;

// The ONE flat "list" section chrome, shared by SectionSurface, EntityCollectionSection and
// EntitySelector so they can't drift apart: a section that bleeds past the host gutter to the screen
// edge, fills with `surface` for contrast against the muted page, carries a raised header strip, and
// closes with a bottom border below its body. Change the flat-section look here, once.
//
// A header-only shell (no children — e.g. the "Add <Label>" selector row) drops the wrapper's bottom
// border and relies on the header's own border-b, so it reads as a single strip with one closing line.
// The mirror image — a body with no `title` — drops the header strip instead (see the prop).
export function ListSectionShell({
  icon,
  title,
  titleVariant,
  trailing,
  className,
  style,
  children,
}: ListSectionShellProps) {
  const theme = useTheme();
  const hasBody = children != null;
  return (
    <View
      className={className}
      style={[
        {
          marginHorizontal: -theme.space.gutter,
          backgroundColor: theme.colors.surface,
          // Top border caps the header; sections stack flush into one continuous list. Pull each up
          // by one border width so its top border overlaps the previous section's bottom border —
          // adjacent sections collapse to a SINGLE line instead of a doubled one (the first section's
          // 1px shift is absorbed by the screen's top padding).
          marginTop: -theme.borderWidth.sm,
          borderTopWidth: theme.borderWidth.sm,
          borderTopColor: theme.colors.border,
          ...(hasBody
            ? {
                borderBottomWidth: theme.borderWidth.sm,
                borderBottomColor: theme.colors.border,
              }
            : null),
        },
        style,
      ]}
    >
      {title == null ? null : (
        <SectionHeader
          backgroundColor={theme.colors.surfaceSunken}
          icon={icon}
          title={title}
          titleVariant={titleVariant}
          trailing={trailing}
        />
      )}
      {children}
    </View>
  );
}
