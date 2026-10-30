import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import useCheckout from './useCheckout';

vi.mock('../utils/analytics', () => ({
  analyticsItem: vi.fn(() => ({ item_id: '1' })),
  trackEvent: vi.fn(),
}));

describe('useCheckout API contract', () => {
  afterEach(() => vi.restoreAllMocks());

  test('starts checkout and creates an order with the returned session', async () => {
    const checkout = {
      checkout: { id: 42, total: '109.90' },
      payment: { reference: 'SANDBOX-42', method: 'pix' },
    };
    const order = { id: 77, total: '109.90', status: 'paid' };
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => checkout })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ order }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

    const { result } = renderHook(() => useCheckout({ token: 'token', cartItems: [] }));
    act(() => result.current.setCheckoutForm((current) => ({ ...current, address_id: '3', shipping_method: 'standard' })));

    await act(() => result.current.previewCheckout());
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/checkout/start', expect.objectContaining({ method: 'POST' }));
    expect(result.current.checkoutPreview.checkout.id).toBe(42);

    await act(() => result.current.finalizeCheckout());
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/orders', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ checkout_session_id: 42 }),
    }));
    expect(result.current.checkoutResult).toEqual(order);
  });

  test('conclui o pedido da sessão informada ao voltar de redirecionamento da Stripe', async () => {
    const order = { id: 80, total: '50.00', status: 'paid' };
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ order }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

    const { result } = renderHook(() => useCheckout({ token: 'token', cartItems: [] }));
    await act(() => result.current.finalizeCheckout(55));
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/orders', expect.objectContaining({ body: JSON.stringify({ checkout_session_id: 55 }) }));
    expect(result.current.checkoutResult).toEqual(order);
  });

  test('retirada na loja dispensa endereço', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ checkout: { id: 9 }, payment: {} }) });
    const setStatus = vi.fn();
    const { result } = renderHook(() => useCheckout({ token: 'token', cartItems: [], setStatus }));
    act(() => result.current.setCheckoutForm((current) => ({ ...current, shipping_method: 'pickup' })));
    await act(() => result.current.previewCheckout());
    expect(fetch).toHaveBeenCalledWith('/api/checkout/start', expect.objectContaining({ method: 'POST' }));
    expect(setStatus).not.toHaveBeenCalledWith('Selecione ou informe um endereço de entrega.');
  });
});
