// Pure crop-rectangle math (no React / no I/O) — the piece most prone to coordinate bugs, so it lives
// here on its own and is unit-tested. Given the cover-fitted, zoomed, panned image behind a fixed crop
// frame, it returns the framed sub-rectangle in NORMALIZED image coordinates [0..1], clamped so it can
// never fall outside the image.
import type { NormRect } from "@spatch-kit/ui/overlays/crop/imageCropperController";

export type CropTransform = {
  // Image size at cover-fit (the on-screen size when scale = 1; already covers the frame).
  coverW: number;
  coverH: number;
  // Crop frame size (on screen).
  frameW: number;
  frameH: number;
  // User zoom multiplier (>= 1) and pan offset (screen px, image-center relative to frame-center).
  scale: number;
  tx: number;
  ty: number;
};

function clampStart(value: number, size: number): number {
  // A rect of length `size` must start within [0, 1 - size].
  return Math.max(0, Math.min(1 - size, value));
}

export function computeCropRect(t: CropTransform): NormRect {
  const displayW = t.coverW * t.scale;
  const displayH = t.coverH * t.scale;
  const width = Math.min(1, t.frameW / displayW);
  const height = Math.min(1, t.frameH / displayH);
  const rawX = (displayW / 2 - t.frameW / 2 - t.tx) / displayW;
  const rawY = (displayH / 2 - t.frameH / 2 - t.ty) / displayH;
  return {
    x: clampStart(rawX, width),
    y: clampStart(rawY, height),
    width,
    height,
  };
}

// Max pan (screen px) that keeps the frame inside the image at this zoom. The UI clamps tx/ty to
// ±these so computeCropRect stays within bounds without relying on the clamp above.
export function maxPan(t: Pick<CropTransform, "coverW" | "coverH" | "frameW" | "frameH" | "scale">): {
  x: number;
  y: number;
} {
  return {
    x: Math.max(0, (t.coverW * t.scale - t.frameW) / 2),
    y: Math.max(0, (t.coverH * t.scale - t.frameH) / 2),
  };
}

// ── Freeform (resizable box) mode ────────────────────────────────────────────────────────────────
// The document-logo cropper "contain"-fits the image in the area and overlays a box the user drags +
// resizes to ANY size/ratio. These helpers are pure so the box↔image mapping is unit-tested.

// The on-screen rectangle the "contain"-fitted image occupies within the area.
export type FitBox = { dispW: number; dispH: number; imgLeft: number; imgTop: number };

export function computeContainFit(
  areaW: number,
  areaH: number,
  imgW: number,
  imgH: number,
  padding: number,
): FitBox {
  const availW = Math.max(1, areaW - padding * 2);
  const availH = Math.max(1, areaH - padding * 2);
  const scale = Math.min(availW / imgW, availH / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  return {
    dispW,
    dispH,
    imgLeft: (areaW - dispW) / 2,
    imgTop: (areaH - dispH) / 2,
  };
}

// A crop box in screen/display coordinates → normalized image rect [0..1], clamped to the image.
export function boxToNormRect(
  box: { x: number; y: number; w: number; h: number },
  fit: FitBox,
): NormRect {
  const x = Math.max(0, Math.min(1, (box.x - fit.imgLeft) / fit.dispW));
  const y = Math.max(0, Math.min(1, (box.y - fit.imgTop) / fit.dispH));
  const width = Math.max(0, Math.min(1 - x, box.w / fit.dispW));
  const height = Math.max(0, Math.min(1 - y, box.h / fit.dispH));
  return { x, y, width, height };
}
