// Logging seam for the kit tier.
//
// The overlay layer boundary must report a caught render error somewhere, but the kit is a LEAF: it
// may not import @/observability (a Data-tier module that reads the account id and feeds the cloud
// telemetry sink). That would be an upward edge — exactly what layerBoundary.test.ts forbids. So the
// kit declares the minimum logging surface it needs and the composition root injects the real
// logger (startup/registerKitLogger.ts → @/observability/logger).
//
// INERT DEFAULT: console.error. Unlike the real logger (dev-console + telemetry buffer, silent in
// production), the inert path logs unconditionally — an app that hasn't wired a logger has no other
// sink, and silently swallowing an overlay crash is strictly worse than console noise.
//
// Surface is deliberately `error`-only: that is all the kit reports today. Widen it when a kit
// module actually needs another level, not before.
export type KitLoggerSeam = {
  error: (tag: string, event: string, context?: Record<string, unknown>) => void;
};

const inert: KitLoggerSeam = {
  error: (tag, event, context) => {
    const head = `${tag} ${event}`;
    if (context && Object.keys(context).length > 0) {
      console.error(head, context);
    } else {
      console.error(head);
    }
  },
};

let seam: KitLoggerSeam = inert;

export function setLoggerSeam(next: Partial<KitLoggerSeam>): void {
  seam = { ...seam, ...next };
}

export function logKitError(
  tag: string,
  event: string,
  context?: Record<string, unknown>,
): void {
  seam.error(tag, event, context);
}
