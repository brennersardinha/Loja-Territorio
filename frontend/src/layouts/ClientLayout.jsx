import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useBranding } from '../contexts/BrandingContext';
import useStoreInfo from '../hooks/useStoreInfo';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import ResponsiveImage from '../components/ui/ResponsiveImage';

const MAX_MENU_CATEGORIES = 5;

// Link do WhatsApp (wa.me) a partir do número cadastrado; assume DDI 55 quando ausente.
export function whatsappLink(phone, text = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const number = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export default function ClientLayout({ children, user, onLogout, cartCount = 0, categories = [] }) {
  const { branding } = useBranding();
  const { storeInfo } = useStoreInfo();
  const { contact, policies, pickup } = storeInfo;
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const menuButtonRef = useRef(null);
  const firstMenuLinkRef = useRef(null);
  const searchInputRef = useRef(null);
  const whatsapp = whatsappLink(contact.whatsapp, `Olá! Vim pela loja ${branding.store_name}.`);
  const menuCategories = categories.filter((category) => !category.parent_id).slice(0, MAX_MENU_CATEGORIES);
  const navigationItems = [
    { to: '/', label: 'Início' },
    { to: '/buscar', label: 'Produtos' },
    ...menuCategories.map((category) => ({ to: `/buscar?categoria_id=${category.id}`, label: category.nome, categoryId: String(category.id) })),
  ];
  const activeCategory = location.pathname === '/buscar' ? new URLSearchParams(location.search).get('categoria_id') : null;

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { if (location.pathname !== '/buscar') setSearch(''); else setSearch(new URLSearchParams(location.search).get('busca') || ''); }, [location.pathname, location.search]);
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    firstMenuLinkRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') { setMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const submitSearch = (event) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/buscar?busca=${encodeURIComponent(term)}` : '/buscar');
  };

  // Categoria ativa pela query string; "Produtos" só fica ativo sem categoria escolhida.
  const isActive = (item) => {
    if (item.categoryId) return activeCategory === item.categoryId;
    if (item.to === '/buscar') return location.pathname === '/buscar' && !activeCategory;
    return location.pathname === item.to;
  };
  const navigationLinks = navigationItems.map((item, index) => <Link ref={index === 0 ? firstMenuLinkRef : undefined} key={item.to} to={item.to} className={isActive(item) ? 'active' : ''} aria-current={isActive(item) ? 'page' : undefined}>{item.label}</Link>);
  const cartLabel = cartCount > 0 ? `Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}` : 'Carrinho';

  return (
    <div className="site-shell">
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
      <header className="store-header">
        <div className="store-header-main">
          <NavLink className="brand-heading brand-link" to="/" aria-label={`${branding.store_name}, página inicial`}>
            {branding.logo && <ResponsiveImage className="store-logo" src={branding.logo} alt={`${branding.store_name || 'Loja'} — página inicial`} eager />}
            <div><span className="eyebrow">Loja oficial</span><span className="store-name">{branding.store_name}</span></div>
          </NavLink>
          <form className={`header-search ${searchOpen ? 'open' : ''}`} role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="header-search-input">Buscar na loja</label>
            <input ref={searchInputRef} id="header-search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você procura?" />
            <button type="submit" aria-label="Pesquisar"><Icon name="search" /></button>
          </form>
          <div className="header-actions" aria-label="Atalhos da loja">
            <button type="button" className="header-search-toggle" aria-expanded={searchOpen} aria-controls="header-search-input" onClick={() => setSearchOpen((value) => !value)}><Icon name="search" /><span className="header-action-label">Buscar</span></button>
            <NavLink className="header-optional" to="/desejos" aria-label="Favoritos"><Icon name="heart" /><span className="header-action-label" aria-hidden="true">Favoritos</span></NavLink>
            <NavLink className="header-optional" to="/conta" aria-label={user ? 'Minha conta' : 'Entrar'}><Icon name="user" /><span className="header-action-label" aria-hidden="true">{user ? 'Minha conta' : 'Entrar'}</span></NavLink>
            <NavLink className="header-cart" to="/carrinho" aria-label={cartLabel}><Icon name="bag" /><span className="header-action-label" aria-hidden="true">Carrinho</span>{cartCount > 0 && <span className="cart-count" aria-hidden="true">{cartCount > 99 ? '99+' : cartCount}</span>}</NavLink>
            {user && <Button className="header-logout" variant="ghost" size="sm" onClick={onLogout}>Sair</Button>}
          </div>
          <Button ref={menuButtonRef} className="mobile-menu-button" variant="ghost" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? 'Fechar' : 'Menu'}</Button>
        </div>
        <nav className="store-navigation" aria-label="Navegação principal">{navigationLinks}</nav>
        {menuOpen && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); } }}><nav id="mobile-navigation" className="mobile-navigation" aria-label="Menu principal móvel"><div className="mobile-navigation-header"><strong>Navegar</strong><Button variant="ghost" size="sm" onClick={() => { setMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); }}>Fechar</Button></div>{navigationLinks}<Link to="/desejos">Favoritos</Link><Link to="/conta">{user ? 'Minha conta' : 'Entrar ou criar conta'}</Link>{user && <Button variant="ghost" onClick={onLogout}>Sair da conta</Button>}</nav></div>}
      </header>

      <div className="app-shell">
        <main id="conteudo-principal" className="workspace">{children}</main>
      </div>
      {whatsapp && <a className="whatsapp-float" href={whatsapp} target="_blank" rel="noreferrer" aria-label="Falar com a loja pelo WhatsApp"><Icon name="chat" size={26} /><span>WhatsApp</span></a>}
      <footer className="store-footer"><div><strong>{branding.store_name}</strong><span>Compra segura, entrega acompanhada e suporte quando precisar.</span>{pickup.enabled && <span>Loja física: {pickup.address} · {pickup.hours}</span>}</div>{(contact.email || contact.phone || contact.whatsapp) && <div aria-label="Contato"><strong>Atendimento</strong>{contact.email && <span>{contact.email}</span>}{contact.phone && <span>{contact.phone}</span>}{contact.whatsapp && (whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp: {contact.whatsapp}</a> : <span>WhatsApp: {contact.whatsapp}</span>)}</div>}{(policies.privacy || policies.exchanges) && <nav aria-label="Políticas da loja">{policies.exchanges && <NavLink to="/politicas/trocas">Trocas e devoluções</NavLink>}{policies.privacy && <NavLink to="/politicas/privacidade">Privacidade</NavLink>}</nav>}</footer>
    </div>
  );
}
