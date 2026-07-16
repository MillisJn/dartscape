import { useEffect, useState } from "react";
import { Image, View } from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { resolveAvatarPath } from "@spatch-kit/ui/primitives/avatarPathSeam";

// Initials from a resolved display name: first letter of the first two words, or the
// first two letters of a single word. Falls back to "?" for an empty name.
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// A user's avatar: the stored image if one is set, otherwise an initials circle derived
// from the resolved display name.
//
// Two modes:
//   - Uncontrolled (`avatarUri`): a stored app-storage path this resolves itself (async,
//     starting from initials) via the avatarPathSeam. Convenient for list rows where a flash is
//     fine. With no resolver wired the seam yields null and the initials fallback stands.
//   - Controlled (`resolvedUri`): the caller has ALREADY resolved (and ideally prefetched)
//     the displayable uri, so the image renders immediately with no internal async hop.
//     Used by screens that gate themselves on "everything ready" (settings detail headers).
export function Avatar({
  name,
  avatarUri,
  resolvedUri,
  size = 40,
}: {
  name: string;
  avatarUri?: string | null;
  resolvedUri?: string | null;
  size?: number;
}) {
  const theme = useTheme();
  const controlled = resolvedUri !== undefined;
  const [internalUri, setInternalUri] = useState<string | null>(null);

  useEffect(() => {
    if (controlled) {
      return;
    }
    let cancelled = false;
    if (!avatarUri) {
      setInternalUri(null);
      return;
    }
    void resolveAvatarPath(avatarUri)
      .then((uri) => {
        if (!cancelled) {
          setInternalUri(uri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInternalUri(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUri, controlled]);

  const displayUri = controlled ? resolvedUri : internalUri;

  const style = {
    borderRadius: size / 2,
    height: size,
    width: size,
  };

  if (displayUri) {
    return (
      <Image
        source={{ uri: displayUri }}
        style={{
          ...style,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      />
    );
  }

  return (
    <View
      style={{
        ...style,
        alignItems: "center",
        backgroundColor: theme.colors.accentMuted,
        justifyContent: "center",
      }}
    >
      <AppText
        variant="label"
        color="accent"
        style={{ fontSize: Math.round(size * 0.4) }}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}
