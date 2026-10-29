import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const response = (data) => Promise.resolve({ ok: true, json: async () => data });
const profile = { user: { id: 1, nome: 'Admin Responsivo', email: 'admin@teste.com', permissions: ['reports:read', 'store_settings:manage'] } };

function mockApi() {
  global.fetch = vi.fn((url) => {
    const endpoint = String(url);
    if (endpoint === '/api/profile') return response(profile);
    if (endpoint === '/api/products/7') return response({ product: { id: 7, nome: 'Produto Responsivo', preco: 99, estoque: 2, fotos_produto: [], atributos_dinamicos: {} } });
    if (endpoint === '/api/admin/marketing') return response({ marketing: { gtm_id: '', meta_pixel_id: '', robots_disallow: [] } });
    if (endpoint === '/api/admin/branding') return response({ branding: {} });
    if (endpoint.includes('/api/admin/dashboard/metrics')) return response({ metrics: {}, top_products: [] });
    if (endpoint.includes('/api/products')) return response({ items: [], pagination: { page: 1, limit: 12, total: 0, total_pages: 1 } });
    if (endpoint.includes('/api/categories')) return response([]);
    if (endpoint.includes('/api/branding')) return response({ branding: {} });
    return response({ items: [] });
  });
}

function setViewport(width) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = vi.fn((query) => ({ matches: query.includes('max-width') ? width <= Number(query.match(/\d+/)?.[0] || 0) : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

function renderRoute(path) {
  window.history.pushState({}, '', path);
  return render(<BrowserRouter><App /></BrowserRouter>);
}

describe('contratos responsivos das rotas principais', () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
  it.each([['mobile', 390], ['tablet', 768], ['desktop', 1440]])('renderiza rotas críticas em %s (%dpx)', async (_, width) => {
    setViewport(width); mockApi(); document.cookie = 'ecommerce_csrf=csrf-teste; Path=/';
    const routes = [
      ['/', 'Encontre produtos que combinam com você'], ['/buscar', 'Produtos da loja'], ['/produto/7/produto-responsivo', 'Produto Responsivo'], ['/carrinho', 'Carrinho de compras'], ['/checkout', 'Seu carrinho está vazio'], ['/conta', 'Perfil'], ['/admin', 'Visão geral da loja'], ['/admin/marketing', 'Rastreamento seguro'], ['/admin/branding', 'Identidade visual'],
    ];
    for (const [path, text] of routes) {
      renderRoute(path);
      expect(await screen.findAllByText(text, {}, { timeout: 2500 })).not.toHaveLength(0);
      cleanup();
    }
  });
});
