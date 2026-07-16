import { Image } from "react-native";

// Warm an image into the cache before it's rendered, so a screen can show fully-formed
// instead of flashing in. Most valuable on web, where resolved media URIs are network
// presigned URLs (a real decode/round-trip); on native (file://) it's a cheap no-op.
// Best-effort: never throws, and resolves quickly for an empty/failed URI.
export async function prefetchImage(uri: string | null | undefined): Promise<void> {
  if (!uri) {
    return;
  }
  try {
    await Image.prefetch(uri);
  } catch {
    // Ignore — the image still loads lazily when rendered.
  }
}
