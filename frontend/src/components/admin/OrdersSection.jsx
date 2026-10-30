import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { getOrderStatus, nextOrderStatusOptions, orderReference, orderStatusOptions } from '../../config/orderStatus';
import AdminPageHeader from './AdminPageHeader';

// Mesmos status aceitos pelo motor de etiquetas no backend.
const LABEL_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

function OrderStatusForm({ order, loading, onUpdate }) {
  const [status, setStatus] = React.useState(order.status);
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setStatus(order.status);
    setNotes('');
  }, [order.id, order.status]);

  return (
    <div className="form-grid">
      <label>
        Alterar status
        <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={loading}>
          {nextOrderStatusOptions(order.status).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="full-span">
        Notas de status
        <input value={notes} onChange={(event) => setNotes(event.target.value)} disabled={loading} required={status === 'cancelled'} placeholder={status === 'cancelled' ? 'Motivo obrigatório para cancelamento' : 'Informação opcional para o histórico'} />
      </label>
      <div><button className="primary-button" type="button" onClick={() => onUpdate(order.id, status, notes)} disabled={loading}>Atualizar status</button></div>
    </div>
  );
}

function OrderFilters({ filters, loading, onSubmit }) {
  const [search, setSearch] = React.useState(filters?.search || '');
  const [status, setStatus] = React.useState(filters?.status || '');

  React.useEffect(() => {
    setSearch(filters?.search || '');
    setStatus(filters?.status || '');
  }, [filters]);

  return (
    <form className="filters-grid" onSubmit={(event) => { event.preventDefault(); onSubmit({ search, status }); }}>
      <label>Buscar<input name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, cliente, email, ref" /></label>
      <label>Status
        <select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos</option>
          {orderStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button className="primary-button" type="submit" disabled={loading}>Filtrar</button>
    </form>
  );
}

// Pedidos: lista com filtros, detalhes, troca de status e geração de etiquetas.
export default function OrdersSection({ adminOrders, adminOrdersPagination, fetchAdminOrders, fetchAdminOrderDetails, adminOrderDetail, updateAdminOrderStatus, adminOrderFilters, setAdminOrderFilters, loading, formatPrice, formatDateTime }) {
  const { hasPermission } = useAuth();
  const canUpdateOrderStatus = hasPermission(PERMISSIONS.ORDERS_UPDATE_STATUS);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Seleção de pedidos para imprimir etiquetas em lote (só pedidos com pagamento confirmado).
  const [selectedOrders, setSelectedOrders] = React.useState([]);
  const labelEligible = (order) => LABEL_STATUSES.includes(order.status);
  const toggleOrder = (id) => setSelectedOrders((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const eligibleOnPage = adminOrders.filter(labelEligible).map((order) => order.id);
  const allSelected = eligibleOnPage.length > 0 && eligibleOnPage.every((id) => selectedOrders.includes(id));
  const detailRef = React.useRef(null);

  // Abre já filtrado quando vem de um atalho (ex.: pendências da visão geral: ?status=pending).
  React.useEffect(() => {
    const filters = { search: '', status: searchParams.get('status') || '' };
    setAdminOrderFilters(filters);
    fetchAdminOrders(filters, 1);
  }, [searchParams.get('status')]);
  React.useEffect(() => { if (adminOrderDetail) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [adminOrderDetail?.id]);

  const applyFilters = (filters) => { setAdminOrderFilters(filters); fetchAdminOrders(filters, 1); };
  const page = adminOrdersPagination.page || 1;
  const totalPages = adminOrdersPagination.total_pages || 1;
  const totalOrders = Number(adminOrdersPagination.total_items ?? adminOrdersPagination.total ?? adminOrders.length);

  return (
    <section className="admin-page">
      <AdminPageHeader group="Vendas" title="Pedidos" description="Acompanhe os pedidos, atualize o status e gere as etiquetas de envio e separação." aside={<Badge variant="neutral">{totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}</Badge>} />
      <div className="panel admin-panel">
        <OrderFilters filters={adminOrderFilters} loading={loading} onSubmit={applyFilters} />
        {canUpdateOrderStatus && <div className="orders-label-bar"><span>{selectedOrders.length ? `${selectedOrders.length} ${selectedOrders.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}` : 'Selecione pedidos pagos para gerar etiquetas em lote.'}</span><Button size="sm" disabled={!selectedOrders.length} onClick={() => navigate(`/admin/etiquetas?pedidos=${selectedOrders.join(',')}`)}>Gerar etiquetas</Button></div>}
        <div className="table-wrap">
          <table>
            <thead><tr>{canUpdateOrderStatus && <th><input type="checkbox" aria-label="Selecionar todos os pedidos pagos desta página" checked={allSelected} disabled={!eligibleOnPage.length} onChange={() => setSelectedOrders((current) => (allSelected ? current.filter((id) => !eligibleOnPage.includes(id)) : [...new Set([...current, ...eligibleOnPage])]))} /></th>}<th>ID</th><th>Cliente</th><th>Total</th><th>Status</th><th>Etiqueta</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>
              {adminOrders.map((order) => (
                <tr key={order.id}>
                  {canUpdateOrderStatus && <td><input type="checkbox" aria-label={`Selecionar pedido ${orderReference(order)}`} checked={selectedOrders.includes(order.id)} disabled={!labelEligible(order)} onChange={() => toggleOrder(order.id)} /></td>}
                  <td>{orderReference(order)}</td>
                  <td>{order.customer_name || order.customer_email}</td>
                  <td>{formatPrice(order.total)}</td>
                  <td><Badge variant={getOrderStatus(order.status, order).variant}>{getOrderStatus(order.status, order).label}</Badge></td>
                  <td>{order.label_code ? <span className="technical-data" title={order.label_print_count ? `Impressa ${order.label_print_count}×` : 'Ainda não impressa'}>{order.label_code}</span> : <span className="muted-text">—</span>}</td>
                  <td>{formatDateTime(order.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="ghost-button compact" type="button" onClick={() => fetchAdminOrderDetails(order.id)} disabled={loading}>Detalhes</button>
                      {canUpdateOrderStatus && labelEligible(order) && <Link className="ghost-button compact" to={`/admin/etiquetas?pedidos=${order.id}`}>{order.label_code ? 'Reimprimir' : 'Etiqueta'}</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {adminOrders.length === 0 && <tr><td colSpan={canUpdateOrderStatus ? 8 : 7}>Nenhum pedido encontrado para os filtros atuais.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="ghost-button compact" type="button" onClick={() => fetchAdminOrders(adminOrderFilters, page - 1)} disabled={page <= 1 || loading}>Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button className="ghost-button compact" type="button" onClick={() => fetchAdminOrders(adminOrderFilters, page + 1)} disabled={page >= totalPages || loading}>Próxima</button>
        </div>
      </div>

      {adminOrderDetail && (
        <div ref={detailRef} className="panel admin-panel">
          <h3>Pedido <span className="technical-data">{orderReference(adminOrderDetail)}</span></h3>
          <p>Cliente: {adminOrderDetail.customer?.nome} ({adminOrderDetail.customer?.email})</p>
          <p>Status atual: {getOrderStatus(adminOrderDetail.status, adminOrderDetail).label}</p>
          <div className="checkout-lines">
            {adminOrderDetail.items.map((item) => (
              <div key={item.id} className="summary-card">
                <strong>{item.nome_produto}</strong>
                <p>Quantidade: {item.quantidade}</p>
                <p>Valor unitário: {formatPrice(item.preco_unitario)}</p>
              </div>
            ))}
          </div>
          {canUpdateOrderStatus && <OrderStatusForm order={adminOrderDetail} loading={loading} onUpdate={updateAdminOrderStatus} />}
          <h4>Histórico</h4>
          <ul>
            {adminOrderDetail.status_history.map((entry) => (
              <li key={entry.id}>{formatDateTime(entry.created_at)} — {getOrderStatus(entry.status).label} {entry.notes ? `: ${entry.notes}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
