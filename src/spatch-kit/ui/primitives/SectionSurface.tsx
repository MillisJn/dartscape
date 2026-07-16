import type { PropsWithChildren, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import type { IconName } from "@spatch-kit/ui/primitives/AppIcon";
import type { TextVariant } from "@spatch-kit/ui/primitives/AppText";
import { ListSectionShell } from "@spatch-kit/ui/primitives/ListSectionShell";
import {
  PRESS_FEEDBACK_DELAY_MS,
  PressableTint,
} from "@spatch-kit/ui/primitives/pressFeedback";

type SectionSurfaceProps = PropsWithChildren<{
  icon?: IconName;
  // Omit to drop the header strip and let the body sit at the top of the section — see
  // ListSectionShell, which owns the behavior. `icon`/`trailing` have nowhere to go without it.
  title?: string;
  titleVariant?: TextVariant;
  // Chevron, menu, or add/delete actions shown at the trailing edge of the bar.
  trailing?: ReactNode;
  // Accepted for API compatibility (callers still pass it); the flat list section has no surface box,
  // so tone is ignored.
  tone?: "default" | "muted" | "raised";
  // true (default) → body gets standard padding + gap; false → children render flush
  // (for list rows that bring their own padding, or full-bleed content like a map).
  bodyPadded?: boolean;
  // Make the body tappable — wraps it in a Pressable. The header (with its own trailing controls)
  // stays outside the press target, so a card can open a record on body-tap while its trailing
  // menu/actions stay independently pressable. Used by the shared linked-record card.
  onPress?: () => void;
  // Fired on touch-down, for warming what `onPress` is about to open. See PressableTint.
  onPressPrefetch?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>;

// The shared section shell: a flat native-list section — no box, just the header hairline + rows that
// bleed to the screen edge (text stays inset), with whitespace between sections. Every section (fields,
// overview, single/multi relation) routes through this so they stay consistent across detail, editor,
// and settings views. The flat look itself lives in ListSectionShell (bleed + surface fill + raised
// header + closing border) so it's defined in exactly one place.
export function SectionSurface({
  children,
  icon,
  title,
  titleVariant,
  trailing,
  bodyPadded = true,
  onPress,
  onPressPrefetch,
  className,
  style,
}: SectionSurfaceProps) {
  const theme = useTheme();
  const body =
    children != null ? (
      bodyPadded ? (
        // List body: md horizontal inset (aligns with the header's px-app-md) so text lines up;
        // vertical padding kept. The section itself bleeds to the edge (see ListSectionShell).
        <View
          className="gap-app-md"
          style={{
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.sm,
          }}
        >
          {children}
        </View>
      ) : (
        children
      )
    ) : null;
  // A tappable body gets the standard accent press tint. It used to be a BARE Pressable with no
  // feedback of any kind, which quietly broke a contract: a card nested inside a tappable section is
  // expected to suppress its OWN press feedback (feedback="none") on the understanding that the
  // section owns the press response. It didn't own it, so those nested cards stayed completely dead
  // under the finger. If this stops tinting, every such nested card silently loses its feedback.
  const bodyElement =
    onPress && body != null ? (
      <PressableTint
        onPress={onPress}
        onPressPrefetch={onPressPrefetch}
        pressDelay={PRESS_FEEDBACK_DELAY_MS}
      >
        {body}
      </PressableTint>
    ) : (
      body
    );

  return (
    <ListSectionShell
      className={className}
      icon={icon}
      style={style}
      title={title}
      titleVariant={titleVariant}
      trailing={trailing}
    >
      {bodyElement}
    </ListSectionShell>
  );
}
