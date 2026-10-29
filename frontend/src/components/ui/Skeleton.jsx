export default function Skeleton({ lines = 3, label = 'Carregando conteúdo' }) {
  return <div className="ui-skeleton" role="status" aria-label={label}>{Array.from({ length: lines }, (_, index) => <span key={index} className="skeleton-line" />)}<span className="sr-only">{label}</span></div>;
}
