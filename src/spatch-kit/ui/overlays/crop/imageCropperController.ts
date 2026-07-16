// Imperative image cropper — same controller/host shape as appAlertController + AppAlertHost. A call
// site (pickAndStoreAvatar / pickAndStoreCompanyAsset) awaits showImageCropper() between the picker
// and the staging seam; the globally-mounted CropEditorHost presents the crop UI and resolves the
// promise with the cropped output (a blob on web, a uri on native) or null.
//
// Settlement is unambiguous and ALWAYS happens:
//   - user cancels / dismisses / host unmounts  → resolve(null)
//   - user confirms                             → resolve(CropOutput)
//   - a crop is already open (double-tap)       → resolve(null)  (benign; NOT a rejected error)
// A processing failure inside the host rejects the promise (surfaced by the call site's existing
// error handling) — a distinct channel from cancel.

export type NormRect = { x: number; y: number; width: number; height: number };

// The cropped result. Web fills `blob`; native fills `uri`. Always JPEG.
export type CropOutput = {
  uri: string | null;
  blob: Blob | null;
  mimeType: "image/jpeg";
};

export type CropRequest = {
  id: string;
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  aspect: number; // width / height of the crop frame (ignored when freeform)
  // Freeform mode: a resizable/movable crop box over the fit image (any size/ratio), instead of the
  // fixed-aspect pan/zoom frame. Used for the document logo.
  freeform: boolean;
  maxEdge: number; // output long-edge cap
  quality: number; // JPEG quality 0..1
};

export type ShowImageCropperArgs = {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  aspect: number;
  freeform?: boolean;
  maxEdge?: number;
  quality?: number;
};

type Listener = (state: CropRequest | null) => void;
type Queued = {
  request: CropRequest;
  resolve: (out: CropOutput | null) => void;
  reject: (error: unknown) => void;
};

const listeners = new Set<Listener>();
// Single-open: at most one active request (no queue — a concurrent request resolves null).
let current: Queued | null = null;

function emit(): void {
  const state = current?.request ?? null;
  for (const listener of listeners) listener(state);
}

function createId(): string {
  return `crop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getImageCropperState(): CropRequest | null {
  return current?.request ?? null;
}

export function subscribeImageCropper(listener: Listener): () => void {
  listeners.add(listener);
  listener(current?.request ?? null);
  return () => {
    listeners.delete(listener);
  };
}

export function showImageCropper(
  args: ShowImageCropperArgs,
): Promise<CropOutput | null> {
  // Busy (a cropper already open) or unknown source dimensions → benign null, never an error.
  if (current || !args.sourceWidth || !args.sourceHeight) {
    return Promise.resolve(null);
  }
  const request: CropRequest = {
    id: createId(),
    sourceUri: args.sourceUri,
    sourceWidth: args.sourceWidth,
    sourceHeight: args.sourceHeight,
    aspect: args.aspect,
    freeform: args.freeform ?? false,
    maxEdge: args.maxEdge ?? 1024,
    quality: args.quality ?? 0.92,
  };
  return new Promise<CropOutput | null>((resolve, reject) => {
    current = { request, resolve, reject };
    emit();
  });
}

// Confirm — the host computed the crop and produced the output.
export function resolveImageCrop(id: string, out: CropOutput): void {
  if (!current || current.request.id !== id) return;
  const { resolve } = current;
  current = null;
  resolve(out);
  emit();
}

// Cancel / dismiss / unmount → resolve(null) (benign, not an error).
export function cancelImageCrop(id: string): void {
  if (!current || current.request.id !== id) return;
  const { resolve } = current;
  current = null;
  resolve(null);
  emit();
}

// Processing failure (decode/encode/too-large) → reject, so the call site's error handling surfaces
// it. A distinct channel from cancel.
export function failImageCrop(id: string, error: unknown): void {
  if (!current || current.request.id !== id) return;
  const { reject } = current;
  current = null;
  reject(error);
  emit();
}
