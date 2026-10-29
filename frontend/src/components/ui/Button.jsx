import { forwardRef } from 'react';

const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingLabel = 'Carregando…',
  startIcon,
  className = '',
  disabled,
  type = 'button',
  ...props
}, ref) {
  const classes = ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, fullWidth ? 'ui-button--full' : '', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} type={type} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="button-spinner" aria-hidden="true" /> : startIcon && <span className="button-icon" aria-hidden="true">{startIcon}</span>}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
});

export default Button;
