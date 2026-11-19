const STORAGE_KEY = 'ironlog_error_log';
const MAX_ERRORS = 25;

export function getErrorLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearErrorLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function logError(source, err, extra = null) {
  try {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : JSON.stringify(err);
    const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : null;

    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      source,
      message: message || 'Unknown error',
      stack,
      extra,
    };

    const existing = getErrorLogs();
    const updated = [entry, ...existing].slice(0, MAX_ERRORS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

let handlersInitialized = false;
export function initGlobalErrorHandlers() {
  if (handlersInitialized || typeof window === 'undefined') return;
  handlersInitialized = true;

  window.addEventListener('error', (event) => {
    logError('window.error', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError('unhandledrejection', event.reason || 'Unhandled promise rejection');
  });
}
