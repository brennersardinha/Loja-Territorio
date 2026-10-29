import { useCallback, useState } from 'react';

export default function useAdminMetrics({ token, setStatus, setLoading, showToast }) {
  const [adminMetrics, setAdminMetrics] = useState({
    total_usuarios: 0,
    total_produtos: 0,
    total_categorias: 0,
    total_estoque: 0,
    valor_estoque: 0,
    carrinhos_criados: 0,
    itens_em_carrinhos: 0,
    itens_em_listas_desejos: 0,
    total_vendas: 0,
  });
  const [topProducts, setTopProducts] = useState([]);

  const parseResponse = useCallback(async (response) => {
    const data = await response.json();

    if (!response.ok) {
      const message = data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.';
      throw new Error(message);
    }

    return data;
  }, []);

  const fetchAdminMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/dashboard/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseResponse(response);
      setAdminMetrics(data.metrics || {
        total_usuarios: 0,
        total_produtos: 0,
        total_categorias: 0,
        total_estoque: 0,
        valor_estoque: 0,
        carrinhos_criados: 0,
        itens_em_carrinhos: 0,
        itens_em_listas_desejos: 0,
        total_vendas: 0,
      });
      setTopProducts(data.top_products || []);
    } catch (error) {
      setStatus(error.message);
      showToast?.(error.message, 'error');
    }
  }, [token, parseResponse, setStatus, showToast]);

  return {
    adminMetrics,
    setAdminMetrics,
    topProducts,
    setTopProducts,
    fetchAdminMetrics,
  };
}
