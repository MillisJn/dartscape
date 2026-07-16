// A tiny module singleton so only ONE tooltip is ever visible at a time. When the pointer sweeps
// across a toolbar, each button would otherwise open its own bubble and they'd briefly overlap
// (the outgoing one's fade-out crossing the incoming one's fade-in). Opening a tooltip here closes
// any other. It also tracks recent activity so adjacent tooltips open "warm" (near-instant) once
// one is already up — standard tooltip UX — instead of re-waiting the full hover-intent delay.
//
// Mirrors the codebase's other UI singletons (appAlertController, appFeedbackController).

type Listener = (activeId: number | null) => void;

let activeId: number | null = null;
let lastActiveAt = 0;
let nextId = 1;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener(activeId);
  }
}

export function nextTooltipId(): number {
  return nextId++;
}

export function openTooltip(id: number): void {
  activeId = id;
  lastActiveAt = Date.now();
  notify();
}

// Genuine user-driven close (hover-out). Stamps `lastActiveAt` so an adjacent button can open "warm".
export function closeTooltip(id: number): void {
  if (activeId !== id) return;
  activeId = null;
  lastActiveAt = Date.now();
  notify();
}

// Teardown close (unmount / disabled / preference-off). Clears the singleton if this id holds it, but
// does NOT stamp `lastActiveAt` — passing through a disabled control or unmounting must never warm the
// next open (only real hover activity does).
export function relinquishTooltip(id: number): void {
  if (activeId !== id) return;
  activeId = null;
  notify();
}

export function isTooltipActive(id: number): boolean {
  return activeId === id;
}

// True when a tooltip is currently open, or one closed within `windowMs`. Callers use this to pick a
// short "warm" open delay so moving between neighboring buttons feels immediate.
export function isTooltipWarm(windowMs: number): boolean {
  if (activeId !== null) return true;
  return Date.now() - lastActiveAt < windowMs;
}

export function subscribeTooltip(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
