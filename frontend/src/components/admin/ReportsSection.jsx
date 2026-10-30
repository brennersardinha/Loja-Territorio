import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import AdminPageHeader from './AdminPageHeader';
import { parseAdminResponse } from './adminApi';

// Relatórios: resumo de vendas e produtos que mais entram nos carrinhos.
export default function ReportsSection({ token, topProducts, fetchAdminMetrics, formatPrice }) {
  const { showToast } = useToast();
  const [salesReport, setSalesReport] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  async function loadSalesReport() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/reports/sales', { headers: { Authorization: `Bearer ${token}` } });
      setSalesReport(await parseAdminResponse(response, 'Falha ao carregar relatório.'));
    } catch (error) { showToast(error.message, 'error'); } finally { setBusy(false); }
  }

  React.useEffect(() => { loadSalesReport(); fetchAdminMetrics(); }, [token]);
  const maximum = Math.max(...topProducts.map((item) => Number(item.quantidade_em_carrinhos || 0)), 1);

  return (
    <section className="admin-page">
      <AdminPageHeader group="Vendas" title="Relatórios" description="Resumo das vendas e dos produtos com mais interesse dos clientes." aside={<button className="ghost-button compact" type="button" onClick={() => { loadSalesReport(); fetchAdminMetrics(); }} disabled={busy}>Atualizar</button>} />
      <div className="admin-metric-grid">
        <article><span>Pedidos</span><strong className="technical-data">{salesReport?.summary?.total_orders ?? 0}</strong></article>
        <article><span>Receita</span><strong>{formatPrice(salesReport?.summary?.total_revenue ?? 0)}</strong></article>
        <article><span>Descontos</span><strong>{formatPrice(salesReport?.summary?.total_discount ?? 0)}</strong></article>
        <article><span>Frete</span><strong>{formatPrice(salesReport?.summary?.total_shipping ?? 0)}</strong></article>
      </div>
      <section className="panel admin-panel admin-chart" aria-labelledby="popular-products-title">
        <div className="panel-header"><h3 id="popular-products-title">Produtos mais adicionados</h3><Badge variant="info">Carrinhos</Badge></div>
        {topProducts.length > 0 ? <div className="bar-chart">{topProducts.slice(0, 10).map((product) => { const value = Number(product.quantidade_em_carrinhos || 0); return <div key={product.id}><span>{product.nome}</span><div><i style={{ width: `${Math.max(4, value / maximum * 100)}%` }} /><span>{value}</span></div></div>; })}</div> : <EmptyState title="Sem dados de produtos" description="Os produtos adicionados aos carrinhos aparecerão neste gráfico." />}
      </section>
    </section>
  );
}
