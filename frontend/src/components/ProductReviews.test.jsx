import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProductReviews from './ProductReviews';
import { ToastProvider } from '../contexts/ToastContext';

function response(data, ok = true) {
  return Promise.resolve({ ok, json: async () => data });
}

function renderReviews(props = {}) {
  return render(<ToastProvider><ProductReviews productId={7} {...props} /></ToastProvider>);
}

describe('ProductReviews', () => {
  it('lists public reviews and hides the form for visitors', async () => {
    global.fetch = vi.fn(() => response({ items: [{ id: 1, usuario_id: 2, usuario_nome: 'Ana', nota: 4, comentario: 'Muito bom' }] }));

    renderReviews();

    expect(await screen.findByText('Muito bom')).toBeInTheDocument();
    expect(screen.getByText('Entre na sua conta para avaliar este produto.')).toBeInTheDocument();
  });

  it('submits an authenticated review and reloads the list', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ review: { id: 3 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 3, usuario_id: 1, usuario_nome: 'Ana', nota: 5, comentario: 'Excelente produto' }] }) });

    renderReviews({ token: 'token-teste', user: { id: 1 } });
    await screen.findByText('Seja o primeiro a avaliar este produto.');
    fireEvent.change(screen.getByLabelText('Comentário'), { target: { value: 'Excelente produto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/reviews', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText('Excelente produto')).toBeInTheDocument();
  });
});
