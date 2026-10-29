const icons = { success: '✓', danger: '!', warning: '!', info: 'i', neutral: '•' };

export default function Badge({ children, variant = 'neutral', icon = icons[variant], className = '' }) {
  return <span className={`ui-badge ui-badge--${variant} ${className}`.trim()}><span aria-hidden="true">{icon}</span><span>{children}</span></span>;
}
