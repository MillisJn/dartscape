export type AppLoadingOverlayState = {
  detail?: string;
  id: string;
  label: string;
};

export type AppToastState = {
  id: string;
  message: string;
};

export type AppFeedbackState = {
  loadingOverlay: AppLoadingOverlayState | null;
  toast: AppToastState | null;
};

type LoadingOverlayUpdate = {
  detail?: string;
  label?: string;
};

type AppToastOptions = {
  durationMs?: number;
  message: string;
};

type AppFeedbackListener = (state: AppFeedbackState) => void;

const listeners = new Set<AppFeedbackListener>();

let state: AppFeedbackState = {
  loadingOverlay: null,
  toast: null,
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function emitState() {
  for (const listener of listeners) {
    listener(state);
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getAppFeedbackState() {
  return state;
}

export function subscribeAppFeedback(listener: AppFeedbackListener) {
  listeners.add(listener);
  listener(state);

  return () => {
    listeners.delete(listener);
  };
}

export function showAppLoadingOverlay({
  detail,
  label,
}: Omit<AppLoadingOverlayState, "id">) {
  const id = createId("loading");

  state = {
    ...state,
    loadingOverlay: {
      detail,
      id,
      label,
    },
  };
  emitState();

  return id;
}

export function updateAppLoadingOverlay(
  id: string,
  updates: LoadingOverlayUpdate,
) {
  if (!state.loadingOverlay || state.loadingOverlay.id !== id) {
    return;
  }

  state = {
    ...state,
    loadingOverlay: {
      ...state.loadingOverlay,
      ...updates,
    },
  };
  emitState();
}

export function hideAppLoadingOverlay(id?: string) {
  if (!state.loadingOverlay) {
    return;
  }

  if (id && state.loadingOverlay.id !== id) {
    return;
  }

  state = {
    ...state,
    loadingOverlay: null,
  };
  emitState();
}

export async function runWithAppLoadingOverlay<T>(
  overlay: Omit<AppLoadingOverlayState, "id">,
  task: (controls: {
    update: (updates: LoadingOverlayUpdate) => void;
  }) => Promise<T>,
) {
  const overlayId = showAppLoadingOverlay(overlay);

  try {
    return await task({
      update(updates) {
        updateAppLoadingOverlay(overlayId, updates);
      },
    });
  } finally {
    hideAppLoadingOverlay(overlayId);
  }
}

export function dismissAppToast(id?: string) {
  if (!state.toast) {
    return;
  }

  if (id && state.toast.id !== id) {
    return;
  }

  state = {
    ...state,
    toast: null,
  };
  emitState();
}

export function showAppToast({ durationMs = 2400, message }: AppToastOptions) {
  const id = createId("toast");

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  state = {
    ...state,
    toast: {
      id,
      message,
    },
  };
  emitState();

  toastTimer = setTimeout(() => {
    toastTimer = null;
    dismissAppToast(id);
  }, durationMs);

  return id;
}
