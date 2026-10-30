import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShippingEstimator from './ShippingEstimator';

const formatPrice = (value) => `R$ ${Number(value).toFixed(2)}`;

describe('ShippingEstimator', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('aplica máscara de CEP e lista opções com prazo e preço', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ quotes: [{ service_name: 'Padrão', cost: 19.9, delivery_days: 7 }, { service_name: 'Expresso', cost: 0, delivery_days: 1 }] }) }));
    render(<ShippingEstimator productId={9} quantity={2} formatPrice={formatPrice} />);
    const input = screen.getByLabelText('CEP');
    fireEvent.change(input, { target: { value: '59000000' } });
    expect(input).toHaveValue('59000-000');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));
    expect(await screen.findByText('R$ 19.90')).toBeInTheDocument();
    expect(screen.getByText('Grátis')).toBeInTheDocument();
    expect(screen.getByText('até 1 dia útil')).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ product_id: 9, quantity: 2, destination_zip: '59000-000' });
  });

  it('avisa CEP incompleto sem chamar a API', () => {
    global.fetch = vi.fn();
    render(<ShippingEstimator productId={9} formatPrice={formatPrice} />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '590' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um CEP com 8 dígitos.');
    expect(fetch).not.toHaveBeenCalled();
  });
});
