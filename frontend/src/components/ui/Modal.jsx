import { useEffect, useRef } from 'react';
import Button from './Button';

export default function Modal({ open, title, description, children, confirmLabel = 'Confirmar', onConfirm, onClose, danger = false, loading = false, confirmDisabled = false }) {
  const closeRef = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]');
        const focusable = [...(dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || [])];
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus.current?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><div><h2 id="modal-title">{title}</h2><p id="modal-description">{description}</p></div>{children}<div className="modal-actions"><Button ref={closeRef} variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>{confirmLabel}</Button></div></div></div>;
}
