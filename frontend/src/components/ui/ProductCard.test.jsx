import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductCard from './ProductCard';

const formatPrice = (value) => `R$ ${Number(value).toFixed(2)}`;

describe('ProductCard', () => {
  it('exibe mídia, preço, avaliação e ações sempre acessíveis', () => {
    const add = vi.fn(); const favorite = vi.fn(); const details = vi.fn();
    const product = { id: 1, nome: 'Tênis Azul', descricao: 'Leve', preco: 199.9, preco_anterior: 249.9, estoque: 3, fotos_produto: ['https://img.test/tenis.jpg'], avaliacao_media: 4.7, total_avaliacoes: 12 };
    render(<ProductCard product={product} formatPrice={formatPrice} onAddToCart={add} onToggleWishlist={favorite} onDetails={details} />);
    expect(screen.getByRole('img', { name: 'Tênis Azul' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('Oferta')).toBeInTheDocument();
    expect(screen.getByLabelText('4.7 de 5, 12 avaliações')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver detalhes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
    fireEvent.click(screen.getByRole('link', { name: 'Tênis Azul' }));
    expect(add).toHaveBeenCalledWith(product); expect(details).toHaveBeenCalledWith(product);
  });

  it('não exibe estrelas sem avaliações e destaca estoque baixo e retirada', () => {
    render(<ProductCard product={{ id: 3, nome: 'Boné', preco: 50, estoque: 2 }} formatPrice={formatPrice} onAddToCart={() => {}} pickupAvailable />);
    expect(screen.queryByText(/☆|Sem avaliações/)).not.toBeInTheDocument();
    expect(screen.getByText('Últimas unidades')).toBeInTheDocument();
    expect(screen.getByText('Retire grátis na loja')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Boné' })).toHaveAttribute('href', '/produto/3/bone');
  });

  it('usa fallback e bloqueia compra sem estoque', () => {
    render(<ProductCard product={{ id: 2, nome: 'Bolsa', preco: 10, estoque: 0 }} formatPrice={formatPrice} onAddToCart={() => {}} />);
    expect(screen.getByRole('img', { name: 'Imagem indisponível para Bolsa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Produto indisponível' })).toBeDisabled();
  });
});
