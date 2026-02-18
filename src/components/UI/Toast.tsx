import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { generateId } from '@/lib/utils';
import { ToastContext, type ToastVariant } from './useToast';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  icon?: string;
  persistent?: boolean;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', icon?: string, persistent?: boolean) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, variant, icon, persistent }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    if (toast.persistent) return;
    const timer = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.persistent, onRemove]);

  const iconMap: Record<ToastVariant, string> = {
    success: 'check_circle',
    info: 'info',
    warning: 'warning',
    error: 'error'
  };

  return (
    <div className={`toast toast--${toast.variant}`} role="status" aria-live={toast.persistent ? 'assertive' : 'polite'}>
      <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>
        {toast.icon || iconMap[toast.variant]}
      </span>
      {toast.message}
      {toast.persistent && (
        <button
          className="toast__dismiss"
          onClick={() => onRemove(toast.id)}
          aria-label="Dismiss"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
        </button>
      )}
    </div>
  );
}
