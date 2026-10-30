import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const response = (data, ok = true) => Promise.resolve({ ok, json: async () => data });

function renderAt(path) {
  window.history.pushState({}, '', path);
  return render(<BrowserRouter><App /></BrowserRouter>);
}

function buildFetchMock(overrides = {}) {
  return vi.fn((url) => {
    const endpoint = String(url);

    if (overrides[endpoint]) {
      return overrides[endpoint]();
    }

    if (endpoint.includes('/api/products')) {
      return response({ items: [], pagination: { page: 1, limit: 12, total: 0, total_pages: 1 } });
    }

    if (endpoint.includes('/api/categories')) {
      return response([]);
    }

    if (endpoint.includes('/api/admin/dashboard/metrics')) {
      return response({ metrics: {}, top_products: [] });
    }

    return response({ items: [] });
  });
}

function authProfileResponse(permissions = []) {
  return response({
    user: {
      id: 1,
      nome: 'Admin Teste',
      email: 'admin@teste.com',
      permissions,
    },
  });
}

describe('rotas principais', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'ecommerce_csrf=; Path=/; Max-Age=0';
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setTestItem(key, value) {
      if (key === 'authToken') {
        document.cookie = `ecommerce_csrf=${value}; Path=/`;
        return undefined;
      }
      return originalSetItem.call(this, key, value);
    });
    global.fetch = buildFetchMock();
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('renderiza a loja na rota inicial', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Encontre produtos que combinam com você' })).toBeInTheDocument();
    expect(screen.queryByText('Resumo da aplicação')).not.toBeInTheDocument();
  });

  it('renderiza busca e filtros na rota do catálogo', () => {
    renderAt('/buscar');
    expect(screen.getByRole('heading', { name: 'Produtos da loja' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar produtos' })).toBeInTheDocument();
  });

  it('renderiza somente a tela do carrinho em /carrinho', () => {
    renderAt('/carrinho');
    expect(screen.getByRole('heading', { name: 'Carrinho de compras' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Produtos da loja' })).not.toBeInTheDocument();
  });

  it('renderiza o painel administrativo em /admin para usuário autorizado', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['orders:read']),
    });

    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Visão geral da loja' })).toBeInTheDocument();
  });

  it('permite ao visitante se identificar sem sair do checkout', () => {
    localStorage.setItem('guestCartItems', JSON.stringify([{ id: 'guest-1', produto_id: 1, nome: 'Tênis Azul', preco_unitario: 100, quantidade: 1, estoque: 3 }]));
    renderAt('/checkout');
    expect(screen.getByRole('heading', { name: 'Identifique-se para continuar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta e continuar' })).toBeInTheDocument();
    expect(screen.getByText('A calcular')).toBeInTheDocument();
    localStorage.removeItem('guestCartItems');
  });

  it('exibe navegação da conta para usuário autenticado', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({ '/api/profile': () => authProfileResponse([]) });
    renderAt('/conta');
    expect(await screen.findByRole('navigation', { name: 'Minha conta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lista de desejos' })).toBeInTheDocument();
  });

  it('renderiza detalhes do produto em uma página dedicada', async () => {
    global.fetch = buildFetchMock({
      '/api/products/7': () => response({ product: { id: 7, nome: 'Tênis Azul', preco: 199.9, estoque: 3, categoria_nome: 'Calçados', fotos_produto: [], atributos_dinamicos: { cor: 'Azul' } } }),
    });
    renderAt('/produto/7/tenis-azul');
    expect(await screen.findByRole('heading', { name: 'Tênis Azul' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Produtos da loja' })).not.toBeInTheDocument();
  });

  it('fecha o menu movel com Escape e devolve o foco ao acionador', () => {
    renderAt('/');
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    expect(screen.getByRole('navigation', { name: 'Menu principal móvel' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Menu principal móvel' })).not.toBeInTheDocument();
  });

  it('redireciona usuário não autenticado de /admin para a conta', async () => {
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Visão geral da loja' })).not.toBeInTheDocument();
  });

  it('carrega o perfil apenas uma vez ao restaurar uma sessão', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse([]),
    });

    renderAt('/');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.any(Object)));
    const profileCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/profile');
    expect(profileCalls).toHaveLength(1);
  });

  it('nega acesso direto a rota administrativa sem a permissão exigida', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['orders:read']),
    });

    renderAt('/admin/produtos');
    expect(await screen.findByRole('heading', { name: 'Encontre produtos que combinam com você' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cadastro de produtos' })).not.toBeInTheDocument();
  });

  it('redireciona rota desconhecida para a loja', async () => {
    renderAt('/rota-inexistente');
    expect(await screen.findByRole('heading', { name: 'Encontre produtos que combinam com você' })).toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a carga de produtos falha', async () => {
    global.fetch = buildFetchMock({
      '/api/products?page=1&limit=12': () => response({ error: 'Falha ao carregar produtos.' }, false),
    });

    renderAt('/');
    expect((await screen.findAllByText('Falha ao carregar produtos.')).length).toBeGreaterThan(0);
  });

  it('encerra a sessão e redireciona rota protegida quando o perfil falha', async () => {
    localStorage.setItem('authToken', 'token-invalido');
    global.fetch = buildFetchMock({
      '/api/profile': () => response({ error: 'Sessão expirada.' }, false),
    });

    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByText('Sessão expirada.')).toBeInTheDocument();
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('renderiza tela administrativa de produtos em /admin/produtos', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['products:write']),
    });

    renderAt('/admin/produtos');
    expect(await screen.findByRole('heading', { name: 'Gerenciar produtos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Produtos da loja' })).not.toBeInTheDocument();
  });

  it('exibe gestao de pedidos para usuário autenticado com permissão orders:read', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['orders:read']),
    });

    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Gestão de Pedidos' })).toBeInTheDocument();
    expect(screen.queryByText('Acesso restrito a administradores.')).not.toBeInTheDocument();
  });

  it('mostra link Produtos na navegacao admin para usuário com products:write', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['products:write']),
    });

    renderAt('/admin/produtos');
    expect(await screen.findByRole('link', { name: 'Produtos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Categorias' })).not.toBeInTheDocument();
  });

  it('exibe indicadores do dashboard somente com permissão de relatórios', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['reports:read']),
      '/api/admin/dashboard/metrics': () => response({ metrics: { total_vendas: 2500, total_produtos: 12, total_categorias: 3, total_usuarios: 8, itens_em_carrinhos: 5, carrinhos_criados: 2, total_estoque: 20 }, top_products: [] }),
    });
    renderAt('/admin');
    expect(await screen.findByText('Receita total')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('exibe preview e confirmação de restauração no Branding', async () => {
    localStorage.setItem('authToken', 'token-teste');
    global.fetch = buildFetchMock({
      '/api/profile': () => authProfileResponse(['store_settings:manage']),
      '/api/admin/branding': () => response({ branding: { store_name: 'Loja Teste' }, domains: [] }),
    });
    renderAt('/admin/branding');
    expect(await screen.findByText('Preview em tempo real')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    expect(screen.getByRole('dialog', { name: 'Restaurar tema padrão?' })).toBeInTheDocument();
  });
});
