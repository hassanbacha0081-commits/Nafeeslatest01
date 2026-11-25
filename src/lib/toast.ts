export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

type ToastListener = (toast: ToastItem) => void;

const listeners = new Set<ToastListener>();
let nextId = 1;

export function showToast(message: string, type: ToastType = 'info') {
  const item: ToastItem = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(item));
}

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
