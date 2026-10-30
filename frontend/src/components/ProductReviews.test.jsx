import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductReviews from './ProductReviews';
import { ToastProvider } from '../contexts/ToastContext';

const json = (data, ok = true) => Promise.resolve({ ok, json: async () => data });

// Responde por URL: lista pública, elegibilidade do cliente e envio da avaliação.
function mockApi({ reviews = [], eligibility = { can_review: false, already_reviewed: false } } = {}) {
  global.fetch = vi.fn((url, options = {}) => {
    if (String(url).endsWith('/eligibility')) return json(eligibility);
    if (options.method === 'POST') return json({ review: { id: 3 } });
    return json({ items: reviews });
  });
}

function renderReviews(props = {}) {
  return render(<ToastProvider><ProductReviews productId={7} {...props} /></ToastProvider>);
}

describe('ProductReviews', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('lista avaliações aprovadas e não oferece formulário a visitantes', async () => {
    mockApi({ reviews: [{ id: 1, usuario_id: 2, usuario_nome: 'Ana', nota: 4, comentario: 'Muito bom' }] });
    renderReviews();
    expect(await screen.findByText('Muito bom')).toBeInTheDocument();
    expect(screen.getByText('Compra verificada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar avaliação' })).not.toBeInTheDocument();
    expect(screen.getByText('Somente clientes que receberam o produto podem avaliá-lo.')).toBeInTheDocument();
  });

  it('some quando não há avaliações e o cliente não comprou o produto', async () => {
    mockApi({ eligibility: { can_review: false, purchased: false, already_reviewed: false } });
    renderReviews({ token: 'token-teste', user: { id: 1 } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/reviews/product/7/eligibility', expect.anything()));
    expect(screen.queryByRole('heading', { name: 'Avaliações' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Comentário')).not.toBeInTheDocument();
  });

  it('quem recebeu o produto avalia e é avisado da moderação', async () => {
    mockApi({ eligibility: { can_review: true, purchased: true, already_reviewed: false } });
    renderReviews({ token: 'token-teste', user: { id: 1 } });
    fireEvent.change(await screen.findByLabelText('Comentário'), { target: { value: 'Couro de ótima qualidade' } });
    mockApi({ eligibility: { can_review: false, purchased: true, already_reviewed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));
    expect(await screen.findByText('Obrigado! Sua avaliação aparece aqui depois de aprovada pela loja.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/reviews', expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByLabelText('Comentário')).not.toBeInTheDocument();
  });
});
