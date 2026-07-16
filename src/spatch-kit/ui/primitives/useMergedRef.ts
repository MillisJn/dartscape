import { useCallback, type MutableRefObject, type Ref } from "react";

// Fan a single host node out to several refs. IconButton needs its Pressable node in two places at
// once: the caller's forwarded ref (menu anchors point their popover at the button) AND an internal
// ref the tooltip measures. Returns a stable callback ref that writes the node to each.
export function useMergedRef<T>(
  ...refs: Array<Ref<T> | undefined>
): (node: T | null) => void {
  return useCallback((node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as MutableRefObject<T | null>).current = node;
      }
    }
    // Refs are spread as individual deps; the caller passes stable refs (useRef / forwardRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);
}
