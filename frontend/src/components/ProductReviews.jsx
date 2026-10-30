import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';

const emptyForm = { nota: '5', comentario: '' };

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
  return data;
}

// Avaliações públicas aprovadas; o formulário só aparece para quem recebeu o produto.
export default function ProductReviews({ productId, token, user, className = '' }) {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [eligibility, setEligibility] = useState({ can_review: false, already_reviewed: false });
  const [sentForModeration, setSentForModeration] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!productId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/reviews/product/${productId}`);
      const data = await parseResponse(response);
      setReviews(data.items || []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, showToast]);

  const loadEligibility = useCallback(async () => {
    if (!productId || !token) { setEligibility({ can_review: false, already_reviewed: false }); return; }
    try {
      const response = await fetch(`/api/reviews/product/${productId}/eligibility`, { headers: { Authorization: `Bearer ${token}` } });
      setEligibility(response.ok ? await response.json() : { can_review: false, already_reviewed: false });
    } catch {
      setEligibility({ can_review: false, already_reviewed: false });
    }
  }, [productId, token]);

  useEffect(() => {
    setForm(emptyForm);
    setEditingId(null);
    setSentForModeration(false);
    loadReviews();
  }, [loadReviews]);

  useEffect(() => { loadEligibility(); }, [loadEligibility]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitReview(event) {
    event.preventDefault();
    const comentario = form.comentario.trim();
    if (!Number.isInteger(Number(form.nota)) || Number(form.nota) < 1 || Number(form.nota) > 5) {
      showToast('Selecione uma nota entre 1 e 5.', 'error');
      return;
    }
    if (comentario.length < 3) {
      showToast('O comentário deve ter ao menos 3 caracteres.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(editingId ? `/api/reviews/${editingId}` : '/api/reviews', {
        method: editingId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { nota: Number(form.nota), comentario } : { produto_id: productId, nota: Number(form.nota), comentario }),
      });
      await parseResponse(response);
      setForm(emptyForm);
      setEditingId(null);
      if (!editingId) setSentForModeration(true);
      await Promise.all([loadReviews(), loadEligibility()]);
      showToast(editingId ? 'Avaliação atualizada.' : 'Avaliação enviada.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReview(reviewId) {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await parseResponse(response);
      await Promise.all([loadReviews(), loadEligibility()]);
      showToast('Avaliação removida.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  const showForm = Boolean(token) && (eligibility.can_review || editingId !== null);
  // Sem avaliações e sem quem possa avaliar, a seção some: um bloco vazio só pesa contra o produto.
  if (loading || (reviews.length === 0 && !showForm && !sentForModeration)) return null;

  return (
    <section className={`product-reviews ${className}`.trim()} aria-labelledby="reviews-heading">
      <div className="panel-header">
        <h3 id="reviews-heading">Avaliações</h3>
      </div>

      <div className="review-list">
        {reviews.map((review) => (
          <article key={review.id} className="summary-card review-card">
            <div className="review-heading">
              <strong>{review.usuario_nome}</strong>
              <span aria-label={`${review.nota} de 5 estrelas`}>{'★'.repeat(review.nota)}{'☆'.repeat(5 - review.nota)}</span>
            </div>
            <small className="verified-purchase">Compra verificada</small>
            <p>{review.comentario}</p>
            {user?.id === review.usuario_id && (
              <div className="button-row">
                <button className="ghost-button compact" type="button" onClick={() => { setEditingId(review.id); setForm({ nota: String(review.nota), comentario: review.comentario }); }}>Editar</button>
                <button className="danger-button compact" type="button" onClick={() => deleteReview(review.id)}>Excluir</button>
              </div>
            )}
          </article>
        ))}
      </div>

      {sentForModeration && <p className="muted-text" role="status">Obrigado! Sua avaliação aparece aqui depois de aprovada pela loja.</p>}

      {showForm && (
        <form className="form-grid review-form" onSubmit={submitReview}>
          <h4>{editingId ? 'Editar avaliação' : 'Você já recebeu este produto. Conte o que achou'}</h4>
          <label>Nota
            <select name="nota" value={form.nota} onChange={updateForm} disabled={submitting}>
              {[5, 4, 3, 2, 1].map((nota) => <option key={nota} value={nota}>{nota} estrela{nota > 1 ? 's' : ''}</option>)}
            </select>
          </label>
          <label className="full-span">Comentário
            <textarea name="comentario" rows="3" value={form.comentario} onChange={updateForm} disabled={submitting} minLength="3" maxLength="2000" required placeholder="Qualidade, acabamento, se atendeu ao seu projeto…" />
          </label>
          <div className="button-row full-span">
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : editingId ? 'Salvar avaliação' : 'Enviar avaliação'}</button>
            {editingId && <button className="ghost-button" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}
          </div>
        </form>
      )}

      {!showForm && reviews.length > 0 && <p className="muted-text">Somente clientes que receberam o produto podem avaliá-lo.</p>}
    </section>
  );
}
