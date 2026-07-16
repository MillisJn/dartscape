// NATIVE crop application: expo-image-manipulator crops the picked image at the (normalized) rect and
// caps the output long-edge, re-encoding as JPEG. Orientation is handled by the manipulator on the
// picked (already display-oriented) image, so the rect from the crop UI maps directly. The web
// counterpart (cropImage.web.ts) uses a canvas. Returns a uri; the caller copies it to storage.
import type { CropOutput, NormRect } from "@spatch-kit/ui/overlays/crop/imageCropperController";

export async function applyCropToImage(args: {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  rect: NormRect;
  maxEdge: number;
  quality: number;
}): Promise<CropOutput> {
  const ImageManipulator = await import("expo-image-manipulator");

  const originX = Math.round(args.rect.x * args.sourceWidth);
  const originY = Math.round(args.rect.y * args.sourceHeight);
  const width = Math.max(1, Math.round(args.rect.width * args.sourceWidth));
  const height = Math.max(1, Math.round(args.rect.height * args.sourceHeight));

  const actions: Array<
    | { crop: { originX: number; originY: number; width: number; height: number } }
    | { resize: { width: number } | { height: number } }
  > = [{ crop: { originX, originY, width, height } }];

  const longEdge = Math.max(width, height);
  if (longEdge > args.maxEdge) {
    // Resize by the long edge (specifying one dimension preserves aspect).
    actions.push(
      width >= height
        ? { resize: { width: args.maxEdge } }
        : { resize: { height: args.maxEdge } },
    );
  }

  const result = await ImageManipulator.manipulateAsync(args.sourceUri, actions, {
    compress: args.quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, blob: null, mimeType: "image/jpeg" };
}
