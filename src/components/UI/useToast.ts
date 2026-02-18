import { createContext, useContext, useCallback } from 'react';
import type { AppErrorInfo } from '@/types';
import { recordAppError } from '@/lib/errors';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant, icon?: string, persistent?: boolean) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { showToast } = context;

  const showErrorToast = useCallback((error: AppErrorInfo) => {
    const message = error.userAction
      ? `${error.message} ${error.userAction}`
      : error.message;
    const persistent = error.severity === 'critical' || error.severity === 'high';
    showToast(message, 'error', undefined, persistent);
    recordAppError(error);
  }, [showToast]);

  return { showToast, showErrorToast };
}
