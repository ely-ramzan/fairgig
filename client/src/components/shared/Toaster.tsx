import { useEffect } from 'react';
import { useUiStore } from '../../stores/uiStore';

const AUTO_DISMISS_MS = 5000;

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = window.setTimeout(() => {
      dismissToast(toasts[0].id);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-auto"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`border px-4 py-3 font-mono text-[11px] shadow-none rounded-sm ${
            t.variant === 'error'
              ? 'border-rust text-rust bg-surface'
              : t.variant === 'success'
                ? 'border-jade text-jade bg-surface'
                : 'border-border text-t1 bg-surface'
          }`}
        >
          <div className="flex justify-between gap-4">
            <span>{t.message}</span>
            <button
              type="button"
              className="shrink-0 text-t3 hover:text-t1 uppercase text-[9px] tracking-widest"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
