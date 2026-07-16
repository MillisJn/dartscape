// WEB crop application: decode the picked image with EXIF orientation applied (matching what the crop
// UI's <Image> displayed), crop at the normalized rect, downscale to the output long-edge cap, and
// re-encode as JPEG via <canvas>. Returns a Blob the caller stages for upload.
//
// Memory: a deterministic SOURCE BYTE CEILING rejects pathological files BEFORE decode — the only hard
// bound (createImageBitmap may still materialize a full-resolution intermediate; this is best-effort,
// not a guarantee). Ordinary phone/logo images are well under the ceiling. Browser globals are used
// only inside the function body so this stays import-safe in the native/node graph.
import type { CropOutput, NormRect } from "@spatch-kit/ui/overlays/crop/imageCropperController";

// ~40 MB: comfortably above real avatar/logo/cover picks; a placeholder to be re-tuned from
// target-browser testing (byte size doesn't map linearly to decoded memory).
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export async function applyCropToImage(args: {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  rect: NormRect;
  maxEdge: number;
  quality: number;
}): Promise<CropOutput> {
  const response = await fetch(args.sourceUri);
  if (!response.ok) {
    throw new Error(`Could not read the image (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  if (blob.size > MAX_SOURCE_BYTES) {
    throw new Error("This image is too large. Please choose a smaller one.");
  }

  const decoded = await decodeOriented(blob);
  try {
    const cropX = Math.round(args.rect.x * decoded.width);
    const cropY = Math.round(args.rect.y * decoded.height);
    const cropW = Math.max(1, Math.round(args.rect.width * decoded.width));
    const cropH = Math.max(1, Math.round(args.rect.height * decoded.height));

    const longEdge = Math.max(cropW, cropH);
    const scale = longEdge > args.maxEdge ? args.maxEdge / longEdge : 1;
    const outW = Math.max(1, Math.round(cropW * scale));
    const outH = Math.max(1, Math.round(cropH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    context.drawImage(decoded.image, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    const output = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Could not encode the cropped image.")),
        "image/jpeg",
        args.quality,
      );
    });
    return { uri: null, blob: output, mimeType: "image/jpeg" };
  } finally {
    decoded.cleanup();
  }
}

type DecodedImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

// Decode with EXIF orientation applied (matching the RN-Web <Image> the crop UI showed). Prefer
// createImageBitmap with `imageOrientation: "from-image"`, but SOME engines (older Safari) throw on
// the options dict — so fall back to a plain createImageBitmap, then to an <img> element. Browsers
// apply EXIF to <img> by default, so the fallback stays orientation-consistent for the common cases.
async function decodeOriented(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Options dict unsupported — try the bare form before the <img> fallback.
      try {
        const bitmap = await createImageBitmap(blob);
        return {
          image: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close(),
        };
      } catch {
        // fall through to the <img> path
      }
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error("Could not decode the selected image."));
      element.src = url;
    });
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
