import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useBranding } from '../contexts/BrandingContext';
import useStoreInfo from '../hooks/useStoreInfo';
import Button from '../components/ui/Button';
import ResponsiveImage from '../components/ui/ResponsiveImage';

const clientNavigation = [
  { to: '/', label: 'Início', end: true },
  { to: '/buscar', label: 'Produtos' },
  { to: '/carrinho', label: 'Carrinho' },
  { to: '/desejos', label: 'Desejos' },
  { to: '/conta', label: 'Conta' },
  { to: '/checkout', label: 'Checkout' },
];

export default function ClientLayout({ children, user, onLogout, cartCount = 0 }) {
  const { branding } = useBranding();
  const { storeInfo } = useStoreInfo();
  const { contact, policies, pickup } = storeInfo;
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const firstMenuLinkRef = useRef(null);

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    firstMenuLinkRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') { setMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const navigationLinks = clientNavigation.map(({ to, label, end }, index) => <NavLink ref={index === 0 ? firstMenuLinkRef : undefined} key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
      <header className="store-header">
        <div className="store-header-main">
          <NavLink className="brand-heading brand-link" to="/" aria-label={`${branding.store_name}, página inicial`}>
            {branding.logo && <ResponsiveImage className="store-logo" src={branding.logo} alt={`${branding.store_name || 'Loja'} — página inicial`} eager />}
            <div><span className="eyebrow">Loja oficial</span><span className="store-name">{branding.store_name}</span></div>
          </NavLink>
          <div className="header-actions" aria-label="Atalhos da loja">
            <NavLink to="/desejos"><span aria-hidden="true">♡</span><span>Favoritos</span></NavLink>
            <NavLink to="/conta"><span aria-hidden="true">♙</span><span>{user ? 'Minha conta' : 'Entrar'}</span></NavLink>
            <NavLink className="header-cart" to="/carrinho"><span aria-hidden="true">▣</span><span>Carrinho</span>{cartCount > 0 && <span className="cart-count" aria-label={`${cartCount} itens no carrinho`}>{cartCount > 99 ? '99+' : cartCount}</span>}</NavLink>
            {user && <Button variant="ghost" size="sm" onClick={onLogout}>Sair</Button>}
          </div>
          <Button ref={menuButtonRef} className="mobile-menu-button" variant="ghost" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? 'Fechar' : 'Menu'}</Button>
        </div>
        <nav className="store-navigation" aria-label="Navegação principal">{navigationLinks}</nav>
        {menuOpen && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); } }}><nav id="mobile-navigation" className="mobile-navigation" aria-label="Menu principal móvel"><div className="mobile-navigation-header"><strong>Navegar</strong><Button variant="ghost" size="sm" onClick={() => { setMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); }}>Fechar</Button></div>{navigationLinks}</nav></div>}
      </header>

      <div className="app-shell">
        {branding.banners.length > 0 && <div className="store-banners" aria-label="Destaques da loja">{branding.banners.map((banner, index) => <ResponsiveImage key={banner.slice(-32) + index} src={banner} alt={`Destaque ${index + 1} da loja`} eager={index === 0} />)}</div>}
        <main id="conteudo-principal" className="workspace">{children}</main>
      </div>
      <footer className="store-footer"><div><strong>{branding.store_name}</strong><span>Compra segura, entrega acompanhada e suporte quando precisar.</span>{pickup.enabled && <span>Loja física: {pickup.address} · {pickup.hours}</span>}</div>{(contact.email || contact.phone || contact.whatsapp) && <div aria-label="Contato"><strong>Atendimento</strong>{contact.email && <span>{contact.email}</span>}{contact.phone && <span>{contact.phone}</span>}{contact.whatsapp && <span>WhatsApp: {contact.whatsapp}</span>}</div>}{(policies.privacy || policies.exchanges) && <nav aria-label="Políticas da loja">{policies.exchanges && <NavLink to="/politicas/trocas">Trocas e devoluções</NavLink>}{policies.privacy && <NavLink to="/politicas/privacidade">Privacidade</NavLink>}</nav>}</footer>
    </div>
  );
}
