import React, { createContext, useState, useCallback, useMemo, useRef } from 'react';
import ToastContainer from '../components/ui/ToastContainer';
import ConfirmModal from '../components/ui/ConfirmModal';

// Context — hook tarafindan import edilir (src/hooks/useToast.js)
// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolveRef = useRef(null);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useMemo(() => ({
    error: (msg) => addToast('error', msg),
    warning: (msg) => addToast('warning', msg),
    success: (msg) => addToast('success', msg),
    info: (msg) => addToast('info', msg),
  }), [addToast]);

  const confirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({ isOpen: true, title, message });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    setConfirmState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    setConfirmState(null);
  }, []);

  const contextValue = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmState?.isOpen && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ToastContext.Provider>
  );
}
