import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientLayout, { whatsappLink } from './ClientLayout';
import { clearStoreInfoCache } from '../hooks/useStoreInfo';

function CurrentUrl() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname}{location.search}</output>;
}

function renderLayout(props = {}) {
  return render(<MemoryRouter initialEntries={['/']}><Routes><Route path="*" element={<ClientLayout cartCount={3} categories={[{ id: 2, nome: 'Bolsas' }, { id: 5, nome: 'Carteiras', parent_id: 2 }]} {...props}><CurrentUrl /></ClientLayout>} /></Routes></MemoryRouter>);
}

describe('ClientLayout', () => {
  beforeEach(() => {
    clearStoreInfoCache();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ contact: { whatsapp: '(84) 99999-0000' } }) }));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('menu traz categorias principais e não repete carrinho, conta ou checkout', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(nav).toHaveTextContent('Bolsas');
    expect(nav).not.toHaveTextContent('Carteiras');
    expect(nav).not.toHaveTextContent('Checkout');
    expect(nav).not.toHaveTextContent('Carrinho');
  });

  it('carrinho é identificável e anuncia a quantidade', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Carrinho, 3 itens' })).toHaveAttribute('href', '/carrinho');
  });

  it('busca do cabeçalho leva ao catálogo com o termo', () => {
    renderLayout();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar na loja' }), { target: { value: 'bolsa couro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/buscar?busca=bolsa%20couro');
  });

  it('mostra o botão de WhatsApp com o número da loja', async () => {
    renderLayout();
    expect(await screen.findByRole('link', { name: 'Falar com a loja pelo WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5584999990000'));
  });

  it('rodapé enxuto traz links e a identificação da empresa', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ policies: { privacy: 'Texto', exchanges: '' }, company: { name: 'Território do Couro Ltda', document: '00.939.693/0001-80', address: 'Av. Mato Grosso, 114 - CEP 74513-040' } }) }));
    renderLayout();
    expect(await screen.findByText(/Território do Couro Ltda - CNPJ: 00\.939\.693\/0001-80 - Av\. Mato Grosso, 114/)).toHaveClass('store-footer-legal');
    expect(screen.getByRole('navigation', { name: 'Links do rodapé' })).toHaveTextContent('Política de privacidade');
  });

  it('monta o link do WhatsApp só com número válido', () => {
    expect(whatsappLink('84 99999-0000')).toBe('https://wa.me/5584999990000');
    expect(whatsappLink('+351 912 345 678')).toBe('https://wa.me/351912345678');
    expect(whatsappLink('123')).toBeNull();
  });
});
