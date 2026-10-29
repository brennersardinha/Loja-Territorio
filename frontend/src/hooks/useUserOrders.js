import { useState, useCallback } from 'react';

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.');
    return data;
  });
}

export default function useUserOrders({ token, setStatus, setLoading } = {}) {
  const [userOrders, setUserOrders] = useState([]);
  const [userOrderDetail, setUserOrderDetail] = useState(null);
  const [userOrderTracking, setUserOrderTracking] = useState(null);

  const authHeaders = useCallback((currentToken = token) => ({
    Authorization: `Bearer ${currentToken}`,
    'Content-Type': 'application/json',
  }), [token]);

  async function fetchUserOrders(page = 1, limit = 10) {
    if (!token) {
      setUserOrders([]);
      return;
    }

    try {
      const response = await fetch(`/api/orders?page=${page}&limit=${limit}`, {
        headers: authHeaders(),
      });
      const data = await parseResponse(response);
      setUserOrders(data.items || []);
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function fetchUserOrderTracking(orderId) {
    if (!token) {
      return;
    }

    setLoading?.(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/track`, {
        headers: authHeaders(),
      });
      const data = await parseResponse(response);
      setUserOrderDetail(data.order || null);
      setUserOrderTracking({
        status_history: data.status_history || [],
        tracking: data.tracking || [],
      });
    } catch (error) {
      setStatus?.(error.message);
    } finally {
      setLoading?.(false);
    }
  }

  function resetUserOrdersState() {
    setUserOrders([]);
    setUserOrderDetail(null);
    setUserOrderTracking(null);
  }

  return {
    userOrders,
    setUserOrders,
    userOrderDetail,
    setUserOrderDetail,
    userOrderTracking,
    setUserOrderTracking,
    fetchUserOrders,
    fetchUserOrderTracking,
    resetUserOrdersState,
  };
}