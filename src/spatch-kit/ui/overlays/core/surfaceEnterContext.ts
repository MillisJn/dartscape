import { createContext, useContext } from "react";

// Whether the nearest enclosing ANIMATED surface (an AppModal sheet / card) has finished its open
// animation — and a way to wait for that moment.
//
// Geometry read while a sheet is still entering is not trustworthy. The enter slide runs on the
// native driver, so a `measureInWindow` taken mid-slide can report the surface at its pre-animation
// resting place — fully off-screen below — and report it as a STILL value that doesn't change from
// one frame to the next. A keyboard-aware scroll that measured its focused field then computed a
// huge downward scroll, which stuck once the sheet settled: the form opened scrolled halfway down,
// or at its very bottom. That happened only when the keyboard won the race with the slide, which is
// why it was intermittent. Waiting for the enter to settle is the authoritative fix; frame-to-frame
// "has it stopped moving?" sniffing is not, because the mid-slide reading isn't moving either.
//
// The context value is STABLE (ref-backed inside the host, never a fresh object), so publishing
// "entered" re-renders nothing — the same discipline the rest of AppModal follows to keep the open
// animation smooth.
export type SurfaceEnterState = {
  // Runs `callback` once the surface has finished entering — synchronously if it already has.
  // Returns an unsubscribe for a caller that goes away before the enter lands.
  whenEntered: (callback: () => void) => () => void;
};

// The base app tree has no animating host, so it is always "entered" — a plain screen's
// keyboard-aware scroll behaves exactly as it did before this context existed.
const ALWAYS_ENTERED: SurfaceEnterState = {
  whenEntered: (callback) => {
    callback();
    return () => {};
  },
};

const SurfaceEnterContext = createContext<SurfaceEnterState>(ALWAYS_ENTERED);

export const SurfaceEnterProvider = SurfaceEnterContext.Provider;

export function useSurfaceEnter(): SurfaceEnterState {
  return useContext(SurfaceEnterContext);
}
