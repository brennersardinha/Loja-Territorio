// Cabeçalho comum das páginas do admin: grupo do menu, título, descrição e ações da própria página.
export default function AdminPageHeader({ group, title, description, aside }) {
  return (
    <div className="panel-header admin-page-header">
      <div><span className="eyebrow">{group}</span><h2>{title}</h2>{description && <p className="muted-text">{description}</p>}</div>
      {aside && <div className="button-row">{aside}</div>}
    </div>
  );
}
