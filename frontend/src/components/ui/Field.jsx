import { useId, useState } from 'react';

export default function Field({ label, hint, error, success, as = 'input', id, className = '', children, type = 'text', ...props }) {
  const generatedId = useId();
  const fieldId = id || `field-${generatedId.replace(/:/g, '')}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const message = error || success;
  const messageId = message ? `${fieldId}-message` : undefined;
  const describedBy = [hintId, messageId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = as === 'input' && type === 'password';
  const Component = as;
  const control = (
    <Component
      id={fieldId}
      type={as === 'input' ? (isPassword && passwordVisible ? 'text' : type) : undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy}
      className={error ? 'field-control-error' : success ? 'field-control-success' : undefined}
      {...props}
    >
      {children}
    </Component>
  );

  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={fieldId}>{label}</label>
      {isPassword ? <div className="password-control">{control}<button type="button" className="password-toggle" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={passwordVisible}>{passwordVisible ? 'Ocultar' : 'Mostrar'}</button></div> : control}
      {hint && <span id={hintId} className="field-hint">{hint}</span>}
      {message && <span id={messageId} className={error ? 'field-message field-message-error' : 'field-message field-message-success'} role={error ? 'alert' : 'status'}>{message}</span>}
    </div>
  );
}
