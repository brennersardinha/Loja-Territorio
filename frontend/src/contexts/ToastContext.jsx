import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info', options = {}) => {
    setToast({ id: Date.now(), message, type, ...options });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toast={toast} onClose={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider.');
  }

  return context;
}
