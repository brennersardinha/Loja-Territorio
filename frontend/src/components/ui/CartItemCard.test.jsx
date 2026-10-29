import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CartItemCard from './CartItemCard';

const formatPrice = (value) => `R$ ${Number(value).toFixed(2)}`;

describe('CartItemCard', () => {
  it('altera a quantidade com controles nomeados e respeita o estoque', () => {
    const update = vi.fn();
    const item = { id: 1, nome: 'Camiseta', quantidade: 2, estoque: 3, preco_unitario: 20 };
    const view = render(<CartItemCard item={item} formatPrice={formatPrice} onQuantityChange={update} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade de Camiseta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir quantidade de Camiseta' }));
    expect(update).toHaveBeenNthCalledWith(1, item, 3);
    expect(update).toHaveBeenNthCalledWith(2, item, 1);
    expect(screen.getByText('R$ 40.00')).toBeInTheDocument();
    view.unmount();
  });

  it('comunica indisponibilidade sem depender apenas de cor', () => {
    render(<CartItemCard item={{ id: 1, nome: 'Camiseta', quantidade: 1, estoque: 0, preco_unitario: 20 }} formatPrice={formatPrice} onQuantityChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Produto indisponível');
    expect(screen.getByRole('button', { name: 'Aumentar quantidade de Camiseta' })).toBeDisabled();
  });
});
