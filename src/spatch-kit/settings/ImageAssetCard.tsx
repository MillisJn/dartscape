import type { StyleProp, ViewStyle } from "react-native";
import { Image, Pressable, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { IconButton } from "@spatch-kit/ui/primitives/IconButton";
import { SectionSurface } from "@spatch-kit/ui/primitives/SectionSurface";

type ImageAssetCardProps = {
  // The image's title (e.g. "Logo", "Cover", "Document Logo").
  title: string;
  // Header glyph — an image-ish icon by default, matching every other settings shell.
  icon?: IconName;
  // Resolved preview URI, or null when nothing is set yet.
  uri: string | null;
  // Opens the image selector directly (both the pencil and tapping the preview call it).
  onEdit: () => void;
  busy?: boolean;
  // `contain` keeps a wide/tall logo un-cropped; the default `cover` fills a banner.
  contain?: boolean;
  // Preview box shape: width / height. Square logo ≈ 1; wide cover ≈ 16/6. Ignored when
  // `previewHeight` is set.
  aspectRatio?: number;
  // Fixed preview height (px). Use it to align two cards side by side (the box then fills the card's
  // full width at this height, even with no image) instead of deriving height from the aspect ratio.
  previewHeight?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

// A self-contained settings shell for a single image asset: image icon + title + a pencil that opens
// the selector straight away (no intermediate edit mode), with a tappable preview below. Shares the
// exact SectionSurface chrome as every other settings card.
export function ImageAssetCard({
  title,
  icon = "media",
  uri,
  onEdit,
  busy = false,
  contain = false,
  aspectRatio = 16 / 6,
  previewHeight,
  className,
  style,
}: ImageAssetCardProps) {
  const theme = useTheme();

  return (
    <SectionSurface
      className={className}
      style={style}
      icon={icon}
      title={title}
      trailing={
        <IconButton
          disabled={busy}
          icon="edit"
          label={`Edit ${title.toLowerCase()}`}
          onPress={onEdit}
        />
      }
    >
      <Pressable
        accessibilityLabel={`Edit ${title.toLowerCase()}`}
        accessibilityRole="button"
        disabled={busy}
        onPress={onEdit}
        style={({ pressed }) => ({ opacity: pressed || busy ? 0.85 : 1 })}
      >
        <View
          className="overflow-hidden rounded-app-md border"
          style={{
            ...(previewHeight != null
              ? { height: previewHeight }
              : { aspectRatio }),
            alignItems: "center",
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            justifyContent: "center",
            width: "100%",
          }}
        >
          {uri ? (
            <Image
              resizeMode={contain ? "contain" : "cover"}
              source={{ uri }}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <View className="items-center gap-app-xxs">
              <AppIcon color={theme.colors.mutedText} name={icon} size={26} />
              <AppText color="mutedText" variant="caption">
                {`Tap to add ${title.toLowerCase()}`}
              </AppText>
            </View>
          )}
        </View>
      </Pressable>
    </SectionSurface>
  );
}
