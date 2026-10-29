import Button from './Button';

export default function EmptyState({ title, description, actionLabel, onAction, icon = '◇' }) {
  return <div className="empty-state"><span className="empty-state-icon" aria-hidden="true">{icon}</span><strong>{title}</strong>{description && <span>{description}</span>}{actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}</div>;
}
