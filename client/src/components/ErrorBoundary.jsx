import React from 'react';
import { AlertTriangle, RefreshCw, Copy, Trash2, X } from 'lucide-react';
import { logError, getErrorLogs, clearErrorLogs } from '../utils/errorLog';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('React.ErrorBoundary', error, {
      componentStack: errorInfo?.componentStack?.split('\n').slice(0, 6).join('\n') || null,
    });
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || 'An unexpected error occurred';
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 safe-top safe-bottom">
          <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Something went wrong</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words font-mono bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                {msg}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(JSON.stringify(getErrorLogs(), null, 2));
                  } catch {}
                }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Log
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorLogModal({ isOpen, onClose }) {
  const [logs, setLogs] = React.useState([]);

  React.useEffect(() => {
    if (isOpen) {
      setLogs(getErrorLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center modal-safe-overlay">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-full flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">App Error Log</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Last {logs.length} recorded errors (stored locally)</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No errors recorded.</div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{entry.source}</span>
                  <span>{new Date(entry.time).toLocaleString()}</span>
                </div>
                <div className="text-xs font-mono text-slate-900 dark:text-slate-100 break-words">
                  {entry.message}
                </div>
                {entry.extra && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
                    {typeof entry.extra === 'string' ? entry.extra : JSON.stringify(entry.extra)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              clearErrorLogs();
              setLogs([]);
            }}
            className="px-3 py-2 text-xs font-semibold text-red-500 flex items-center gap-1 rounded-xl"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(JSON.stringify(logs, null, 2));
                  } catch {}
                }}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-semibold rounded-xl flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
