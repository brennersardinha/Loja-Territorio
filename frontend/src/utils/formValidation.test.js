import { describe, expect, it } from 'vitest';
import { validateAddressForm, validateCheckoutForm, validatePriceFilters, validateProductForm } from './formValidation';

describe('form validation', () => {
  it('rejects invalid product attributes and accepts a valid product', () => {
    const product = { nome: 'Camiseta', preco: '29.90', estoque: '3', atributos_dinamicos: '{"cor":"azul"}' };
    expect(validateProductForm(product)).toBeNull();
    expect(validateProductForm({ ...product, atributos_dinamicos: '[]' })).toMatch(/objeto JSON/);
  });

  it('validates price range ordering', () => {
    expect(validatePriceFilters({ min_preco: '50', max_preco: '20' })).toMatch(/mínimo/);
    expect(validatePriceFilters({ min_preco: '20', max_preco: '50' })).toBeNull();
  });

  it('requires a valid delivery address for checkout', () => {
    expect(validateCheckoutForm({ address_id: '', shipping_address_text: '' })).toMatch(/endereço/);
    expect(validateCheckoutForm({ address_id: '4', shipping_address_text: '' })).toMatch(/opção de entrega/);
    expect(validateCheckoutForm({ address_id: '4', shipping_method: 'standard' })).toBeNull();
    expect(validateCheckoutForm({ address_id: '4', shipping_method: '', shipping_quote_id: 'q1' })).toBeNull();
    expect(validateCheckoutForm({ shipping_method: 'pickup' })).toBeNull();
    expect(validateAddressForm({ label: 'Casa', recipient_name: 'Ana', street: 'Rua A', city: 'São Paulo', state: 'SP', zip_code: '01001-000' })).toBeNull();
  });
});
