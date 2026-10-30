import { NavLink, useLocation } from 'react-router-dom';
import { DASHBOARD_ACCESS_PERMISSIONS, PERMISSIONS } from '../config/permissions';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';

// Menu agrupado por assunto; cada item abre a página responsável pelas próprias ações.
const adminNavigationGroups = [
  { title: null, items: [{ to: '/admin', label: 'Visão geral', end: true, permissions: DASHBOARD_ACCESS_PERMISSIONS }] },
  { title: 'Vendas', items: [
    { to: '/admin/pedidos', label: 'Pedidos', permissions: [PERMISSIONS.ORDERS_READ] },
    { to: '/admin/clientes', label: 'Clientes', permissions: [PERMISSIONS.CUSTOMERS_READ] },
    { to: '/admin/relatorios', label: 'Relatórios', permissions: [PERMISSIONS.REPORTS_READ] },
  ] },
  { title: 'Catálogo', items: [
    { to: '/admin/produtos', label: 'Produtos', permissions: [PERMISSIONS.PRODUCTS_WRITE] },
    { to: '/admin/categorias', label: 'Categorias', permissions: [PERMISSIONS.CATEGORIES_WRITE] },
    { to: '/admin/avaliacoes', label: 'Avaliações', permissions: [PERMISSIONS.REVIEWS_MODERATE] },
    { to: '/admin/estoque', label: 'Estoque e webhooks', permissions: [PERMISSIONS.INVENTORY_KEYS_MANAGE] },
  ] },
  { title: 'Marketing', items: [
    { to: '/admin/cupons', label: 'Cupons', permissions: [PERMISSIONS.COUPONS_MANAGE] },
    { to: '/admin/marketing', label: 'Pixels e rastreamento', permissions: [PERMISSIONS.STORE_SETTINGS_MANAGE] },
  ] },
  { title: 'Configurações', items: [
    { to: '/admin/loja', label: 'Dados da loja', permissions: [PERMISSIONS.STORE_SETTINGS_MANAGE] },
    { to: '/admin/branding', label: 'Identidade visual', permissions: [PERMISSIONS.STORE_SETTINGS_MANAGE] },
    { to: '/admin/pagamento', label: 'Moeda e pagamento', permissions: [PERMISSIONS.STORE_SETTINGS_MANAGE] },
    { to: '/admin/integracoes', label: 'Integrações', permissions: [PERMISSIONS.INTEGRATIONS_MANAGE] },
  ] },
];
const adminNavigation = adminNavigationGroups.flatMap(({ items }) => items);

export default function AdminLayout({ children, user, onLogout }) {
  const { hasAnyPermission, store } = useAuth();
  const { branding } = useBranding();
  const storeName = branding.store_name || store?.name || 'Minha Loja';
  const location = useLocation();
  const currentPage = adminNavigation.find(({ to, end }) => end ? location.pathname === to : location.pathname.startsWith(to))?.label || 'Administração';
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#conteudo-admin">Ir para o conteúdo</a>
      <aside className="admin-sidebar">
        <div className="admin-brand"><span className="admin-brand-mark" aria-hidden="true">◆</span><div><strong>{storeName}</strong><small>Painel administrativo</small></div></div>
        <nav className="admin-navigation" aria-label="Navegação administrativa">
          {adminNavigationGroups.map(({ title, items }) => {
            const visible = items.filter(({ permissions }) => hasAnyPermission(permissions));
            if (!visible.length) return null;
            return <div key={title || 'inicio'} className="admin-nav-group" role="group" aria-label={title || 'Início'}>
              {title && <span className="admin-nav-title" aria-hidden="true">{title}</span>}
              {visible.map(({ to, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>)}
            </div>;
          })}
          <div className="admin-nav-group"><NavLink to="/">← Ver loja</NavLink></div>
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar"><div><nav className="admin-breadcrumb" aria-label="Navegação estrutural"><NavLink to="/admin">{storeName}</NavLink><span aria-hidden="true">/</span><span aria-current="page">{currentPage}</span></nav><h1 className="admin-page-title">{currentPage === 'Visão geral' ? 'Visão geral da loja' : currentPage}</h1></div>{user && <div className="admin-user"><span aria-hidden="true">{(user.nome || 'A').slice(0, 1).toUpperCase()}</span><div><strong>{user.nome}</strong><small>{user.email}</small></div><button className="ghost-button compact" type="button" onClick={onLogout}>Sair</button></div>}</header>
        <main id="conteudo-admin" className="workspace admin-content">{children}</main>
      </div>
    </div>
  );
}
