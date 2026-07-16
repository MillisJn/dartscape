import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Platform, type View } from "react-native";

export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Measures an anchor element's position in window coordinates so an overlay can be positioned
// against it from a top-level portal (where it no longer shares the anchor's layout context).
// `measureInWindow` works on web and native; the live-tracking listeners are web-only — on web
// the anchor can move/resize from scrolling, window resize, rotation, or its own content
// changing (a badge/count/name), and a `ResizeObserver` on the node catches that last case which
// fires no window event. Returns null until measured / while inactive.
export function useAnchorRect(
  anchorRef: RefObject<View | null>,
  active: boolean,
): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }

    let raf = 0;
    const measure = () => {
      const node = anchorRef.current;
      if (!node?.measureInWindow) {
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        // A 0×0 read means the node isn't laid out yet; keep the last good rect.
        if (width || height) {
          setRect({ x, y, width, height });
        }
      });
    };

    // Measure now and again next frame (layout often settles a frame after open).
    measure();
    raf = requestAnimationFrame(measure);

    let cleanupWeb: (() => void) | undefined;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onChange = () => measure();
      // capture:true so nested scroll containers (not just window) re-trigger a measure.
      window.addEventListener("scroll", onChange, true);
      window.addEventListener("resize", onChange);
      window.addEventListener("orientationchange", onChange);

      let observer: ResizeObserver | undefined;
      const node = anchorRef.current as unknown as Element | null;
      if (node && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(onChange);
        observer.observe(node);
      }

      cleanupWeb = () => {
        window.removeEventListener("scroll", onChange, true);
        window.removeEventListener("resize", onChange);
        window.removeEventListener("orientationchange", onChange);
        observer?.disconnect();
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      cleanupWeb?.();
    };
  }, [active, anchorRef]);

  return rect;
}
