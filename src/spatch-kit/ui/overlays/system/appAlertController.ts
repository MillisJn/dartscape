// Imperative, themed replacement for React Native's system `Alert.alert`.
// Mirrors the pub/sub structure of `appFeedbackController.ts`: a module-level
// state + listener set drives a globally-mounted host (`AppAlertHost`). The
// public `showAppAlert` returns a promise that resolves with the pressed
// button's `value` (or `undefined` when dismissed), while still invoking each
// button's optional `onPress` — so call sites can use either style.

export type AppAlertButtonStyle = "default" | "cancel" | "destructive";

export type AppAlertButton = {
  /** Visible label. */
  text: string;
  /** Visual treatment. Defaults to "default". */
  style?: AppAlertButtonStyle;
  /** Optional side effect; awaited before the dialog closes. */
  onPress?: () => void | Promise<void>;
  /**
   * Value the `showAppAlert` promise resolves with when this button is pressed.
   * Useful for choice dialogs that previously wrapped `Alert.alert` in a Promise.
   */
  value?: string | null;
};

/**
 * Type-to-confirm guard for destructive dialogs. When set, the dialog shows a text input and
 * keeps every non-`cancel` button disabled until the user types `confirmText` (case-insensitive,
 * trimmed). Used for irreversible actions like a cloud-wide data wipe.
 */
export type AppAlertConfirmInput = {
  confirmText: string;
  placeholder?: string;
};

export type AppAlertOptions = {
  title: string;
  message?: string;
  /** Defaults to a single "OK" button. */
  buttons?: AppAlertButton[];
  /** When false, backdrop tap / back gesture can't dismiss. Defaults to true. */
  cancelable?: boolean;
  /** Require the user to type a confirmation phrase before non-cancel buttons enable. */
  requireInput?: AppAlertConfirmInput;
};

export type AppAlertState = {
  id: string;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  cancelable: boolean;
  requireInput?: AppAlertConfirmInput;
};

type AppAlertListener = (state: AppAlertState | null) => void;

type QueuedAlert = {
  state: AppAlertState;
  resolve: (value: string | null | undefined) => void;
};

const listeners = new Set<AppAlertListener>();

// Alerts are shown one at a time, matching how the OS only surfaces a single
// system alert. Extra requests queue and open as the active one resolves.
const queue: QueuedAlert[] = [];

function activeState(): AppAlertState | null {
  return queue.length > 0 ? queue[0].state : null;
}

function emit() {
  const state = activeState();
  for (const listener of listeners) {
    listener(state);
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getAppAlertState() {
  return activeState();
}

export function subscribeAppAlert(listener: AppAlertListener) {
  listeners.add(listener);
  listener(activeState());

  return () => {
    listeners.delete(listener);
  };
}

export function showAppAlert(
  options: AppAlertOptions,
): Promise<string | null | undefined> {
  const buttons =
    options.buttons && options.buttons.length > 0
      ? options.buttons
      : [{ text: "OK", style: "default" as const }];

  const state: AppAlertState = {
    id: createId("alert"),
    title: options.title,
    message: options.message,
    buttons,
    cancelable: options.cancelable ?? true,
    requireInput: options.requireInput,
  };

  return new Promise<string | null | undefined>((resolve) => {
    queue.push({ state, resolve });
    // Only emit when this alert becomes the active one. Queued alerts wait
    // silently until the host advances to them.
    if (queue.length === 1) {
      emit();
    }
  });
}

function advance(id: string, value: string | null | undefined) {
  const current = queue[0];
  if (!current || current.state.id !== id) {
    return;
  }

  queue.shift();
  current.resolve(value);
  emit();
}

/**
 * Invoked by the host when a button is pressed. Mirrors the OS `Alert`: the
 * dialog closes immediately (promise resolves with the button's `value`, queue
 * advances), then the button's side effect runs. Used internally by
 * `AppAlertHost`.
 */
export function pressAppAlertButton(id: string, buttonIndex: number) {
  const current = queue[0];
  if (!current || current.state.id !== id) {
    return;
  }

  const button = current.state.buttons[buttonIndex];

  advance(id, button?.value);

  if (button?.onPress) {
    void (async () => {
      try {
        await button.onPress!();
      } catch (error) {
        // A button handler must never crash the controller. Surface in dev.
        if (__DEV__) {
          console.error("[AppAlert] button onPress threw", error);
        }
      }
    })();
  }
}

/**
 * Invoked by the host when the alert is dismissed without a button press
 * (backdrop tap / back gesture). Resolves with `undefined`. Used internally by
 * `AppAlertHost`.
 */
export function dismissAppAlert(id: string) {
  advance(id, undefined);
}
