import { useEffect, useState } from 'react';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import Skeleton from './ui/Skeleton';

const statusLabels = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada' };
const statusVariants = { pending: 'warning', approved: 'success', rejected: 'danger' };

export default function ReviewModerationSection({
  reviews,
  pagination,
  statusFilter,
  setStatusFilter,
  loading,
  fetchReviews,
  moderateReview,
  deleteReview,
  formatDateTime,
}) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  function changeStatusFilter(event) {
    setConfirmingDeleteId(null);
    setStatusFilter(event.target.value);
  }

  return (
    <section className="panel wide-panel">
      <div className="panel-header">
        <div>
          <h2>Moderacao de avaliacoes</h2>
          <p className="muted-text">Aprove, rejeite ou remova avaliacoes de produtos.</p>
        </div>
        <button className="ghost-button compact" type="button" onClick={() => fetchReviews(pagination.page)} disabled={loading}>Atualizar</button>
      </div>

      <div className="filters-grid review-moderation-filter">
        <label>Status
          <select aria-label="Filtrar por status" value={statusFilter} onChange={changeStatusFilter} disabled={loading}>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
            <option value="">Todas</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Produto</th><th>Cliente</th><th>Nota</th><th>Comentário</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td>{review.produto_nome || `#${review.produto_id}`}</td>
                <td>{review.usuario_nome || `#${review.usuario_id}`}</td>
                <td aria-label={`${review.nota} de 5 estrelas`}>{'★'.repeat(review.nota)}{'☆'.repeat(5 - review.nota)}</td>
                <td className="review-comment-cell">{review.comentario}</td>
                <td><Badge variant={statusVariants[review.moderation_status] || 'neutral'}>{statusLabels[review.moderation_status] || review.moderation_status}</Badge></td>
                <td>{formatDateTime(review.created_at)}</td>
                <td>
                  {confirmingDeleteId === review.id ? (
                    <div className="row-actions">
                      <button className="danger-button compact" type="button" onClick={async () => { await deleteReview(review.id); setConfirmingDeleteId(null); }} disabled={loading}>Confirmar exclusão</button>
                      <button className="ghost-button compact" type="button" onClick={() => setConfirmingDeleteId(null)} disabled={loading}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="row-actions">
                      {review.moderation_status !== 'approved' && <button className="primary-button compact" type="button" onClick={() => moderateReview(review.id, 'approved')} disabled={loading}>Aprovar</button>}
                      {review.moderation_status !== 'rejected' && <button className="ghost-button compact" type="button" onClick={() => moderateReview(review.id, 'rejected')} disabled={loading}>Rejeitar</button>}
                      <button className="danger-button compact" type="button" onClick={() => setConfirmingDeleteId(review.id)} disabled={loading}>Excluir</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && reviews.length === 0 && <tr><td colSpan="7"><EmptyState title="Nenhuma avaliação encontrada" description="Altere o filtro para consultar outros estados." /></td></tr>}
            {loading && <tr><td colSpan="7"><Skeleton lines={3} label="Carregando avaliações" /></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>Pagina {pagination.page || 1} de {pagination.total_pages || 1}</span>
        <button className="ghost-button compact" type="button" onClick={() => fetchReviews((pagination.page || 1) - 1)} disabled={loading || (pagination.page || 1) <= 1}>Anterior</button>
        <button className="ghost-button compact" type="button" onClick={() => fetchReviews((pagination.page || 1) + 1)} disabled={loading || (pagination.page || 1) >= (pagination.total_pages || 1)}>Proxima</button>
      </div>
    </section>
  );
}
