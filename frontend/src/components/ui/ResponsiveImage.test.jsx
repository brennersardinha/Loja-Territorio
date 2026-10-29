import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ResponsiveImage from './ResponsiveImage';

describe('ResponsiveImage', () => {
  afterEach(cleanup);
  it('carrega de forma adiada e mantém texto alternativo contextual', () => {
    render(<ResponsiveImage src="/produto.webp" alt="Tênis azul" />);
    const image = screen.getByRole('img', { name: 'Tênis azul' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('preserva o espaço com fallback quando a mídia falha', () => {
    render(<ResponsiveImage src="/inexistente.webp" alt="Tênis azul" />);
    fireEvent.error(screen.getByRole('img', { name: 'Tênis azul' }));
    expect(screen.getByRole('img', { name: 'Imagem indisponível para Tênis azul' })).toBeInTheDocument();
  });
});
