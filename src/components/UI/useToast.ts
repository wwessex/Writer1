import { createContext, useContext } from 'react';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant, icon?: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
