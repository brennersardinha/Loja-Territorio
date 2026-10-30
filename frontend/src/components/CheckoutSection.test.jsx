import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutSection from './CheckoutSection';
import { clearStoreInfoCache } from '../hooks/useStoreInfo';

const formatPrice = (value) => `R$ ${Number(value).toFixed(2)}`;
const storeInfo = {
  pickup: { enabled: true, address: 'Rua da Loja, 10', hours: '9h às 18h', instructions: '' },
  contact: {}, policies: {},
  payment: { sandbox: true, stripe_publishable_key: null },
  shipping: { free_shipping_min: 0, quotes_enabled: false, fixed_methods: [{ code: 'standard', label: 'Padrão', cost: 19.9, eta_days: 7 }, { code: 'express', label: 'Expresso', cost: 34.9, eta_days: 3 }] },
};

function renderCheckout(overrides = {}) {
  const current = { form: null };
  const props = {
    loading: false, token: 'csrf', user: { nome: 'Ana' },
    cartItems: [{ id: 1, nome: 'Bolsa', preco_unitario: 100, quantidade: 1 }],
    addressForm: { label: 'Casa', recipient_name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' },
    setAddressForm: vi.fn(), addresses: [], submitAddress: vi.fn(), selectAddress: vi.fn(), previewCheckout: vi.fn(async () => true), finalizeCheckout: vi.fn(),
    shippingQuotes: [], quoteShipping: vi.fn(), quotingShipping: false, checkoutPreview: null, setCheckoutPreview: vi.fn(), checkoutResult: null, checkoutError: '',
    formatPrice, formatDateTime: String, onCheckoutChange: vi.fn(), cartSubtotal: () => 100,
    ...overrides,
  };
  // O formulário vive no App; aqui um componente mínimo guarda o estado entre interações.
  function Harness() {
    const [form, setForm] = useState({ address_id: '', shipping_method: '', shipping_quote_id: '', payment_provider: 'sandbox', payment_method: 'pix', coupon_code: '', ...overrides.checkoutForm });
    current.form = form;
    return <CheckoutSection {...props} checkoutForm={form} setCheckoutForm={setForm} />;
  }
  render(<MemoryRouter><Harness /></MemoryRouter>);
  return { props, getForm: () => current.form };
}

describe('CheckoutSection', () => {
  beforeEach(() => {
    clearStoreInfoCache();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => storeInfo }));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('pergunta primeiro como receber e não mostra frete antes da escolha', async () => {
    renderCheckout();
    expect(await screen.findByRole('radio', { name: /Retirar na loja — grátis/ })).toBeInTheDocument();
    expect(screen.getByText('A calcular')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar para pagamento/ })).toBeDisabled();
  });

  it('retirada dispensa endereço, zera o frete e leva o foco ao título da etapa seguinte', async () => {
    const { getForm } = renderCheckout();
    fireEvent.click(await screen.findByRole('radio', { name: /Retirar na loja — grátis/ }));
    expect(getForm().shipping_method).toBe('pickup');
    expect(screen.getByText('Rua da Loja, 10', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Grátis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar para pagamento/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Como deseja pagar?' })).toHaveFocus());
  });

  it('entrega mostra preço e prazo de cada opção e soma o frete escolhido', async () => {
    const { getForm } = renderCheckout({ addresses: [{ id: 4, street: 'Rua A', number: '1', city: 'Natal', state: 'RN', zip_code: '59000-000' }], checkoutForm: { address_id: '4' } });
    fireEvent.click(await screen.findByRole('radio', { name: /Receber em casa/ }));
    const express = screen.getByRole('radio', { name: /Expresso/ });
    expect(screen.getByText('até 3 dias úteis')).toBeInTheDocument();
    fireEvent.click(express);
    expect(getForm().shipping_method).toBe('express');
    expect(screen.getByText('R$ 134.90')).toBeInTheDocument();
  });
});
