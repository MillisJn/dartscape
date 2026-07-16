import { Component, type ErrorInfo, type ReactNode } from "react";

import { logKitError } from "./loggerSeam";

// `__DEV__` is a build-time global on device; guard with typeof so this is also safe under
// plain node (tests), where it is undefined.
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;

type Props = {
  overlayId: string;
  tier: string;
  componentName?: string;
  // When any reset key changes (the layer's id + visibility), a previously-crashed layer
  // clears its error so re-opening works — a crash isn't permanent until app restart.
  resetKeys: ReadonlyArray<unknown>;
  children: ReactNode;
};

type State = { hasError: boolean };

// Wraps a SINGLE teleported overlay layer so one overlay's render error can't blank the whole
// overlay plane or crash the shell. In dev it surfaces the red box (fail fast); in production
// it isolates the failing layer (renders nothing), logs to telemetry with attributable
// metadata, and the rest of the app keeps running. Recovers on the next open via resetKeys.
export class OverlayLayerBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logKitError("[overlay]", "layer render failed", {
      overlayId: this.props.overlayId,
      tier: this.props.tier,
      componentName: this.props.componentName,
      message: error.message,
      componentStack: info.componentStack,
    });

    // Fail fast in dev: rethrow out-of-band so the RN red box surfaces the original error,
    // while we still render the null fallback below so the rest of the plane is unaffected.
    if (IS_DEV) {
      setTimeout(() => {
        throw error;
      }, 0);
    }
  }

  override componentDidUpdate(prev: Props): void {
    if (!this.state.hasError) return;
    const changed =
      prev.resetKeys.length !== this.props.resetKeys.length ||
      prev.resetKeys.some((key, i) => !Object.is(key, this.props.resetKeys[i]));
    if (changed) {
      this.setState({ hasError: false });
    }
  }

  override render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}
