import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';

const emptyForm = { nota: '5', comentario: '' };

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.');
  return data;
}

export default function ProductReviews({ productId, token, user }) {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

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

  useEffect(() => {
    setForm(emptyForm);
    setEditingId(null);
    loadReviews();
  }, [loadReviews]);

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
      showToast('O comentario deve ter ao menos 3 caracteres.', 'error');
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
      await loadReviews();
      showToast(editingId ? 'Avaliacao atualizada.' : 'Avaliacao enviada.', 'success');
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
      await loadReviews();
      showToast('Avaliacao removida.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  return (
    <section className="product-reviews" aria-labelledby="reviews-heading">
      <div className="panel-header">
        <h3 id="reviews-heading">Avaliacoes</h3>
      </div>

      {loading ? <p className="muted-text">Carregando avaliacoes...</p> : (
        <div className="review-list">
          {reviews.map((review) => (
            <article key={review.id} className="summary-card review-card">
              <div className="review-heading">
                <strong>{review.usuario_nome}</strong>
                <span aria-label={`${review.nota} de 5 estrelas`}>{'★'.repeat(review.nota)}{'☆'.repeat(5 - review.nota)}</span>
              </div>
              <p>{review.comentario}</p>
              {user?.id === review.usuario_id && (
                <div className="button-row">
                  <button className="ghost-button compact" type="button" onClick={() => { setEditingId(review.id); setForm({ nota: String(review.nota), comentario: review.comentario }); }}>Editar</button>
                  <button className="danger-button compact" type="button" onClick={() => deleteReview(review.id)}>Excluir</button>
                </div>
              )}
            </article>
          ))}
          {reviews.length === 0 && <p className="muted-text">Este produto ainda nao possui avaliacoes.</p>}
        </div>
      )}

      {token ? (
        <form className="form-grid review-form" onSubmit={submitReview}>
          <h4>{editingId ? 'Editar avaliacao' : 'Avalie este produto'}</h4>
          <label>Nota
            <select name="nota" value={form.nota} onChange={updateForm} disabled={submitting}>
              {[5, 4, 3, 2, 1].map((nota) => <option key={nota} value={nota}>{nota} estrela{nota > 1 ? 's' : ''}</option>)}
            </select>
          </label>
          <label className="full-span">Comentario
            <textarea name="comentario" rows="3" value={form.comentario} onChange={updateForm} disabled={submitting} minLength="3" maxLength="2000" required />
          </label>
          <div className="button-row full-span">
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : editingId ? 'Salvar avaliacao' : 'Enviar avaliacao'}</button>
            {editingId && <button className="ghost-button" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}
          </div>
        </form>
      ) : <p className="muted-text">Entre na sua conta para avaliar este produto.</p>}
    </section>
  );
}
