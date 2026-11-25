import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { subscribeToToasts, type ToastItem } from '../lib/toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3200);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 left-5 sm:left-auto z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none no-print"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const tone =
          t.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-50'
            : t.type === 'error'
            ? 'bg-red-950/95 border-red-500/50 text-red-50'
            : t.type === 'warning'
            ? 'bg-amber-950/95 border-amber-500/50 text-amber-50'
            : 'bg-zinc-900/95 border-gold/40 text-white';

        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'error'
            ? AlertCircle
            : t.type === 'warning'
            ? AlertTriangle
            : Info;

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-150 ${tone}`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="text-sm font-semibold flex-1 urdu-text leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="p-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              aria-label="Close notification"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
