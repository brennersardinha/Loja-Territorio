import React from 'react';
import { Link } from 'react-router-dom';
import { PERMISSIONS } from '../config/permissions';
import { useAuth } from '../contexts/AuthContext';
import Skeleton from './ui/Skeleton';
import AdminPageHeader from './admin/AdminPageHeader';

// Pendências contadas pela própria lista de pedidos (total da paginação), cada uma com atalho para a página que resolve.
const ORDER_TASKS = [
  { status: 'pending', one: 'pedido aguardando pagamento', many: 'pedidos aguardando pagamento', action: 'Ver pedidos' },
  { status: 'paid', one: 'pedido pago para separar e enviar', many: 'pedidos pagos para separar e enviar', action: 'Separar e gerar etiquetas' },
];

// Visão geral: só indicadores e o que precisa de ação. Cada tarefa é feita na página própria do menu.
export default function AdminSection({ adminMetrics, loading, formatPrice, token }) {
  const { hasPermission } = useAuth();
  const canReadReports = hasPermission(PERMISSIONS.REPORTS_READ);
  const canReadOrders = hasPermission(PERMISSIONS.ORDERS_READ);
  const [orderCounts, setOrderCounts] = React.useState({});

  React.useEffect(() => {
    if (!canReadOrders) return undefined;
    let active = true;
    Promise.all(ORDER_TASKS.map(({ status }) => fetch(`/api/admin/orders?status=${status}&page=1&limit=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => [status, Number(data?.pagination?.total_items ?? data?.pagination?.total ?? 0)])
      .catch(() => [status, 0])))
      .then((entries) => { if (active) setOrderCounts(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [canReadOrders, token]);

  const tasks = [
    ...(canReadOrders ? ORDER_TASKS.filter(({ status }) => orderCounts[status] > 0).map(({ status, one, many, action }) => ({ key: status, text: `${orderCounts[status]} ${orderCounts[status] === 1 ? one : many}`, to: `/admin/pedidos?status=${status}`, action })) : []),
    ...(canReadReports && adminMetrics.total_produtos > 0 && Number(adminMetrics.total_estoque) === 0 ? [{ key: 'estoque', text: 'Nenhum produto com estoque disponível', to: '/admin/produtos', action: 'Revisar produtos' }] : []),
  ];

  return (
    <section className="admin-page admin-dashboard">
      <AdminPageHeader group="Visão geral" title="Hoje na sua loja" description="Indicadores principais e o que precisa da sua atenção. Use o menu lateral para cada tarefa." />
      {canReadReports && (loading
        ? <div className="admin-metric-grid" aria-label="Carregando indicadores">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} lines={2} />)}</div>
        : <div className="admin-metric-grid">
          <article><span>Receita total</span><strong>{formatPrice(adminMetrics.total_vendas)}</strong><small>Vendas registradas</small></article>
          <article><span>Produtos</span><strong className="technical-data">{adminMetrics.total_produtos}</strong><small>{adminMetrics.total_categorias} categorias</small></article>
          <article><span>Clientes</span><strong className="technical-data">{adminMetrics.total_usuarios}</strong><small>Contas cadastradas</small></article>
          <article><span>Itens em carrinhos</span><strong className="technical-data">{adminMetrics.itens_em_carrinhos}</strong><small>{adminMetrics.carrinhos_criados} carrinhos ativos</small></article>
        </div>)}
      <section className="panel admin-panel admin-tasks" aria-labelledby="admin-tasks-title">
        <h3 id="admin-tasks-title">Precisa de atenção</h3>
        {tasks.length > 0
          ? <ul>{tasks.map((task) => <li key={task.key}><span>{task.text}</span><Link to={task.to}>{task.action} →</Link></li>)}</ul>
          : <p className="muted-text">Tudo em dia. Nenhuma pendência no momento.</p>}
      </section>
    </section>
  );
}
