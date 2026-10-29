import { useEffect, useRef, useState } from 'react';
import { uiCopy } from '../config/uiCopy';

const toastMeta = {
  info: { icon: 'i', title: uiCopy.feedback.info },
  success: { icon: '✓', title: uiCopy.feedback.success },
  error: { icon: '!', title: uiCopy.feedback.error },
  warning: { icon: '!', title: uiCopy.feedback.warning },
};

export default function Toast({ toast, onClose }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(5000);
  const startedAt = useRef(0);
  useEffect(() => {
    if (!toast || paused) return undefined;
    startedAt.current = Date.now();
    const timeoutId = setTimeout(onClose, remaining.current);
    return () => { clearTimeout(timeoutId); remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current)); };
  }, [toast, onClose, paused]);

  useEffect(() => { remaining.current = 5000; setPaused(false); }, [toast?.id]);

  if (!toast) return null;

  const type = toast.type || 'info';
  const meta = toastMeta[type] || toastMeta.info;

  return (
    <div className={`toast ${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="toast-icon" aria-hidden="true">{meta.icon}</span>
      <div className="toast-message"><strong>{meta.title}</strong><span>{toast.message}</span></div>
      {toast.actionLabel && <button className="toast-action" type="button" onClick={toast.onAction}>{toast.actionLabel}</button>}
      <button className="toast-close" type="button" onClick={onClose} aria-label={uiCopy.actions.closeNotification}>×</button>
    </div>
  );
}
