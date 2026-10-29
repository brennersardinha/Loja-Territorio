import { describe, expect, it } from 'vitest';
import { getOrderStatus, nextOrderStatusOptions, orderReference } from './orderStatus';

describe('apresentação de pedidos', () => {
  it('traduz estados técnicos em mensagens comerciais', () => {
    expect(getOrderStatus('processing')).toMatchObject({ label: 'Em preparação', variant: 'info' });
    expect(getOrderStatus('delivered')).toMatchObject({ label: 'Entregue', variant: 'success' });
  });

  it('oferece somente transições válidas para o estado atual', () => {
    expect(nextOrderStatusOptions('paid').map(({ value }) => value)).toEqual(['paid', 'processing', 'cancelled']);
    expect(nextOrderStatusOptions('delivered').map(({ value }) => value)).toEqual(['delivered']);
  });

  it('nunca usa o identificador interno como referência pública', () => {
    expect(orderReference({ id: 42 })).toBe('Referência indisponível');
    expect(orderReference({ id: 42, public_reference: 'PED-ABC123' })).toBe('PED-ABC123');
  });
});
