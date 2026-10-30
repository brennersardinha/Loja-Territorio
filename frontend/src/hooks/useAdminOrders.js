import { useCallback, useState } from 'react';

export default function useAdminOrders({ token, setStatus, setLoading, showToast }) {
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminOrdersPagination, setAdminOrdersPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [adminOrderFilters, setAdminOrderFilters] = useState({ search: '', status: '' });
  const [adminOrderDetail, setAdminOrderDetail] = useState(null);

  const parseResponse = useCallback(async (response) => {
    const data = await response.json();

    if (!response.ok) {
      const message = data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.';
      throw new Error(message);
    }

    return data;
  }, []);

  const fetchAdminOrders = useCallback(async (filters = adminOrderFilters, page = 1, limit = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseResponse(response);
      setAdminOrders(data.items || []);
      setAdminOrdersPagination(data.pagination || { page, limit, total: 0, total_pages: 0 });
      setAdminOrderFilters(filters);
    } catch (error) {
      setStatus(error.message);
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, adminOrderFilters, parseResponse, setLoading, setStatus, showToast]);

  const fetchAdminOrderDetails = useCallback(async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseResponse(response);
      setAdminOrderDetail(data.order || null);
    } catch (error) {
      setStatus(error.message);
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, parseResponse, setLoading, setStatus, showToast]);

  const updateAdminOrderStatus = useCallback(async (id, statusValue, notes = '') => {
    try {
      const response = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue, notes }),
      });
      const data = await parseResponse(response);
      // Cancelamento de pedido pago: o estoque volta automaticamente, mas o estorno e feito na Stripe.
      const message = data?.refund_required ? data.message : 'Status atualizado com sucesso.';
      setStatus(message);
      showToast?.(message, data?.refund_required ? 'warning' : 'success');
      await fetchAdminOrderDetails(id);
      await fetchAdminOrders(adminOrderFilters, adminOrdersPagination.page, adminOrdersPagination.limit);
    } catch (error) {
      setStatus(error.message);
      showToast?.(error.message, 'error');
    }
  }, [token, parseResponse, setStatus, showToast, fetchAdminOrderDetails, fetchAdminOrders, adminOrderFilters, adminOrdersPagination]);

  return {
    adminOrders,
    setAdminOrders,
    adminOrdersPagination,
    setAdminOrdersPagination,
    adminOrderFilters,
    setAdminOrderFilters,
    adminOrderDetail,
    setAdminOrderDetail,
    fetchAdminOrders,
    fetchAdminOrderDetails,
    updateAdminOrderStatus,
  };
}
