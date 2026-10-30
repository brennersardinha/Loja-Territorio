import { useCallback, useState } from 'react';

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
  return data;
}

export default function useReviewModeration({ token, showToast } = {}) {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(false);

  const fetchReviews = useCallback(async (page = 1, status = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const response = await fetch(`/api/admin/reviews?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseResponse(response);
      setReviews(data.items || []);
      setPagination(data.pagination || { page, limit: 20, total: 0, total_pages: 1 });
    } catch (error) {
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token, showToast]);

  const moderateReview = useCallback(async (reviewId, status) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await parseResponse(response);
      showToast?.(status === 'approved' ? 'Avaliação aprovada.' : 'Avaliação rejeitada.', 'success');
      await fetchReviews(pagination.page);
    } catch (error) {
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchReviews, pagination.page, showToast, token]);

  const deleteReview = useCallback(async (reviewId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await parseResponse(response);
      showToast?.('Avaliação excluida.', 'success');
      await fetchReviews(pagination.page);
    } catch (error) {
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchReviews, pagination.page, showToast, token]);

  return {
    reviews,
    pagination,
    statusFilter,
    setStatusFilter,
    loading,
    fetchReviews,
    moderateReview,
    deleteReview,
  };
}
