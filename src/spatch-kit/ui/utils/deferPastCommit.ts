/**
 * Run `callback` after the current React commit and the native mount/paint have
 * flushed — the non-deprecated replacement for `InteractionManager.runAfterInteractions`
 * (RN is removing InteractionManager) at the focus call sites that need it.
 *
 * Two chained animation frames are deliberate: the first fires after the frame
 * that committed the current tree, the second after that commit has been mounted
 * and painted. By then a freshly attached TextInput's shadow node is stable, so a
 * `focus()` inside `callback` walks a settled Fabric tree instead of racing the
 * mount commit — the use-after-free that aborts the process natively with
 * "Scudo ERROR: invalid chunk state" (SIGABRT) when RN's native `autoFocus`
 * focuses an input as it attaches.
 *
 * Returns a cancel function; call it on unmount so a rapid mount→unmount never
 * runs `callback` against a torn-down view.
 */
export function deferPastCommit(callback: () => void): () => void {
  let innerFrame = 0;
  const outerFrame = requestAnimationFrame(() => {
    innerFrame = requestAnimationFrame(callback);
  });
  return () => {
    cancelAnimationFrame(outerFrame);
    cancelAnimationFrame(innerFrame);
  };
}
