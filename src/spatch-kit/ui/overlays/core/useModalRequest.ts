import { useCallback, useEffect, useState } from "react";

export type ModalRequestController<T> = {
  // The payload kept mounted through the exit animation. Render the modal while this is non-null.
  rendered: T | null;
  // The live open intent. Pass to the modal's `visible` so it can fade OUT when it flips false.
  visible: boolean;
  // Open the modal with a payload (or replace the current one).
  open: (request: T) => void;
  // Begin closing — keeps `rendered` so the modal fades out before it unmounts.
  close: () => void;
  // Pass to the modal's `onClosed`; clears `rendered` once the exit fade has finished.
  onClosed: () => void;
};

// Drives a request-style modal that is conditionally mounted by its parent (the common
// `{request ? <Modal visible /> : null}` pattern). On its own that pattern can't animate: the
// modal mounts already-open (no entrance) and unmounts the instant the request clears (no exit).
//
// This hook splits the single request into two pieces of state:
//   • `visible` — the live intent, flipped false by close() so the modal can play its exit fade.
//   • `rendered` — the payload, held until onClosed() fires after the fade so the tree stays
//     mounted during the transition.
//
// Usage:
//   const detail = useModalRequest<DetailRequest>();
//   detail.open(req);                                   // open
//   {detail.rendered ? (
//     <DetailModal {...detail.rendered} visible={detail.visible}
//       onClose={detail.close} onClosed={detail.onClosed} />
//   ) : null}
export function useModalRequest<T>(): ModalRequestController<T> {
  const [request, setRequest] = useState<T | null>(null);
  const [rendered, setRendered] = useState<T | null>(null);

  // Mirror the live request into `rendered` whenever it opens/changes; closing leaves the last
  // payload in place so the modal has something to render while it fades out.
  useEffect(() => {
    if (request) {
      setRendered(request);
    }
  }, [request]);

  // Set `rendered` in the SAME commit as `request` — NOT one effect later. The effect below is the
  // fallback (covers a payload swap while already open), but on a fresh open, waiting for it costs a
  // whole render cycle before the modal even starts mounting, which the user feels as lag between the
  // tap and the sheet appearing. Seeding both together mounts the modal on the tap frame.
  const open = useCallback((next: T) => {
    setRendered(next);
    setRequest(next);
  }, []);
  const close = useCallback(() => setRequest(null), []);
  const onClosed = useCallback(() => setRendered(null), []);

  return { rendered, visible: request != null, open, close, onClosed };
}
