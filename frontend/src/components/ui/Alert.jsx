const icons = { success: '✓', error: '!', warning: '!', info: 'i' };

export default function Alert({ title, children, variant = 'info', persistent = true }) {
  return <div className={`ui-alert ui-alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'} aria-live={variant === 'error' ? 'assertive' : 'polite'} data-persistent={persistent || undefined}><span className="ui-alert-icon" aria-hidden="true">{icons[variant]}</span><div><strong>{title}</strong>{children && <div>{children}</div>}</div></div>;
}
