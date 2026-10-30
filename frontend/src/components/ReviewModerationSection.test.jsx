import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReviewModerationSection from './ReviewModerationSection';

const review = {
  id: 1,
  produto_id: 4,
  produto_nome: 'Camiseta',
  usuario_id: 2,
  usuario_nome: 'Ana',
  nota: 5,
  comentario: 'Excelente produto',
  moderation_status: 'pending',
  created_at: '2026-01-01T10:00:00.000Z',
};

function renderSection(overrides = {}) {
  const props = {
    reviews: [review],
    pagination: { page: 1, total_pages: 1 },
    statusFilter: 'pending',
    setStatusFilter: vi.fn(),
    loading: false,
    fetchReviews: vi.fn(),
    moderateReview: vi.fn(),
    deleteReview: vi.fn(),
    formatDateTime: () => '01/01/2026',
    ...overrides,
  };
  render(<ReviewModerationSection {...props} />);
  return props;
}

describe('ReviewModerationSection', () => {
  afterEach(() => cleanup());

  it('permite aprovar e rejeitar uma avaliação pendente', () => {
    const props = renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar' }));

    expect(props.moderateReview).toHaveBeenCalledWith(1, 'approved');
    expect(props.moderateReview).toHaveBeenCalledWith(1, 'rejected');
  });

  it('exige confirmação antes de excluir uma avaliação', () => {
    const props = renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));

    expect(props.deleteReview).toHaveBeenCalledWith(1);
  });
});
