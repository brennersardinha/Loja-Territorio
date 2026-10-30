import React from 'react';
import { PERMISSIONS } from '../config/permissions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
import EmptyState from './ui/EmptyState';
import Skeleton from './ui/Skeleton';
import { getOrderStatus, nextOrderStatusOptions, orderReference, orderStatusOptions } from '../config/orderStatus';

function OrderStatusForm({ order, loading, onUpdate }) {
  const [status, setStatus] = React.useState(order.status);
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setStatus(order.status);
    setNotes('');
  }, [order.id, order.status]);

  function submitStatusUpdate() {
    onUpdate(order.id, status, notes);
  }

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
      <div>
        <button className="primary-button" type="button" onClick={submitStatusUpdate} disabled={loading}>Atualizar status</button>
        <button className="ghost-button compact" type="button" onClick={() => window.scrollTo(0, 0)}>Voltar ao topo</button>
      </div>
    </div>
  );
}

export default function AdminSection({
  adminMetrics,
  topProducts,
  fetchAdminMetrics,
  customerSearch,
  setCustomerSearch,
  fetchCustomers,
  customers,
  fetchCustomerDetails,
  customerDetail,
  customerEditForm,
  submitCustomerEdit,
  selectedCustomer,
  loading,
  onCustomerEditChange,
  formatPrice,
  formatDateTime,
  adminOrders,
  adminOrdersPagination,
  fetchAdminOrders,
  fetchAdminOrderDetails,
  adminOrderDetail,
  updateAdminOrderStatus,
  user,
  token,
  adminOrderFilters,
  setAdminOrderFilters,
}) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const { showToast } = useToast();
  const canReadOrders = hasPermission(PERMISSIONS.ORDERS_READ);
  const canUpdateOrderStatus = hasPermission(PERMISSIONS.ORDERS_UPDATE_STATUS);
  const canReadCustomers = hasPermission(PERMISSIONS.CUSTOMERS_READ);
  const canWriteCustomers = hasPermission(PERMISSIONS.CUSTOMERS_WRITE);
  const canReadReports = hasPermission(PERMISSIONS.REPORTS_READ);
  const canManageCoupons = hasPermission(PERMISSIONS.COUPONS_MANAGE);
  const canManageStoreSettings = hasPermission(PERMISSIONS.STORE_SETTINGS_MANAGE);
  const canAccessDashboard = hasAnyPermission([
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.COUPONS_MANAGE,
    PERMISSIONS.STORE_SETTINGS_MANAGE,
  ]);
  const [storeSettings, setStoreSettings] = React.useState(null);
  const [salesReport, setSalesReport] = React.useState(null);
  const [coupons, setCoupons] = React.useState([]);
  const [couponForm, setCouponForm] = React.useState({
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: '',
    min_order_value: '0',
    usage_limit: '',
    active: true,
    starts_at: '',
    ends_at: '',
  });
  const [settingsForm, setSettingsForm] = React.useState({
    currency: { code: 'BRL', symbol: 'R$', decimals: 2 },
    tax_rates: [],
    shipping_methods: [],
    payment_methods: ['pix', 'boleto', 'cartao'],
  });

  React.useEffect(() => {
    if (!canAccessDashboard) {
      return;
    }

    async function loadAdminExtras() {
      try {
        if (canManageStoreSettings) {
          const settingsResponse = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } });
          const settingsData = await parseAdminResponse(settingsResponse, 'Falha ao carregar configurações.');
          const loadedSettings = settingsData.settings || {};
          setStoreSettings(loadedSettings);
          setSettingsForm({
            currency: loadedSettings.currency || { code: 'BRL', symbol: 'R$', decimals: 2 },
            tax_rates: loadedSettings.tax_rates || [],
            shipping_methods: loadedSettings.shipping_methods || [],
            payment_methods: loadedSettings.payment_methods || ['pix', 'boleto', 'cartao'],
          });
        }

        if (canManageCoupons) {
          const couponsResponse = await fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${token}` } });
          const couponsData = await parseAdminResponse(couponsResponse, 'Falha ao carregar cupons.');
          setCoupons(couponsData.items || []);
        }
      } catch (error) {
        showToast(error.message || 'Falha ao carregar dados administrativos.', 'error');
      }
    }

    loadAdminExtras();
  }, [canAccessDashboard, canManageCoupons, canManageStoreSettings, token, showToast]);

  async function parseAdminResponse(response, fallbackMessage) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || fallbackMessage);
    }

    return data;
  }

  async function submitSettings(event) {
    event.preventDefault();
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      await parseAdminResponse(response, 'Falha ao salvar configurações.');
      setStoreSettings(settingsForm);
      showToast('Configurações atualizadas.', 'success');
    } catch (error) {
      showToast(error.message || 'Falha ao salvar configurações.', 'error');
    }
  }

  async function loadSalesReport() {
    try {
      const response = await fetch('/api/admin/reports/sales', { headers: { Authorization: `Bearer ${token}` } });
      const data = await parseAdminResponse(response, 'Falha ao carregar relatorio.');
      setSalesReport(data);
      showToast('Relatorio gerado.', 'success');
    } catch (error) {
      showToast(error.message || 'Falha ao carregar relatorio.', 'error');
    }
  }

  async function submitCoupon(event) {
    event.preventDefault();
    try {
      const payload = {
        ...couponForm,
        discount_value: Number(couponForm.discount_value),
        min_order_value: Number(couponForm.min_order_value || 0),
        usage_limit: couponForm.usage_limit === '' ? null : Number(couponForm.usage_limit),
        active: Boolean(couponForm.active),
      };
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseAdminResponse(response, 'Falha ao criar cupom.');
      setCoupons((current) => [data.coupon, ...current]);
      setCouponForm({
        code: '',
        description: '',
        discount_type: 'percent',
        discount_value: '',
        min_order_value: '0',
        usage_limit: '',
        active: true,
        starts_at: '',
        ends_at: '',
      });
      showToast('Cupom cadastrado.', 'success');
    } catch (error) {
      showToast(error.message || 'Falha ao criar cupom.', 'error');
    }
  }

  if (!canAccessDashboard) {
    return (
      <section className="panel wide-panel">
        <div className="panel-header"><h2>Dashboard admin</h2></div>
        <p className="muted-text">Acesso restrito a administradores.</p>
      </section>
    );
  }

  function Filters() {
    const [search, setSearch] = React.useState(adminOrderFilters?.search || '');
    const [status, setStatus] = React.useState(adminOrderFilters?.status || '');

    React.useEffect(() => {
      setSearch(adminOrderFilters?.search || '');
      setStatus(adminOrderFilters?.status || '');
    }, [adminOrderFilters]);

    return (
      <form className="filters-grid" onSubmit={(e) => { e.preventDefault(); const f = { search, status }; setAdminOrderFilters(f); fetchAdminOrders(f, 1); }}>
        <label>Buscar<input name="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID, cliente, email, ref" /></label>
        <label>Status
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {orderStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={loading}>Filtrar</button>
      </form>
    );
  }

  return (
    <section className="admin-dashboard">
      <div className="panel-header">
        <div><span className="eyebrow">Hoje na sua loja</span><h2>Dashboard administrativo</h2></div>
        <div className="button-row">
          {canReadReports && <button className="ghost-button compact" type="button" onClick={fetchAdminMetrics}>Atualizar</button>}
          {canReadCustomers && <button className="ghost-button compact" type="button" onClick={() => fetchCustomers(customerSearch)}>Clientes</button>}
        </div>
      </div>

      {loading && canReadReports && <div className="admin-metric-grid" aria-label="Carregando indicadores">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} lines={2} />)}</div>}
      {!loading && canReadReports && <div className="admin-metric-grid">
        <article><span>Receita total</span><strong>{formatPrice(adminMetrics.total_vendas)}</strong><small>Vendas registradas</small></article>
        <article><span>Produtos</span><strong className="technical-data">{adminMetrics.total_produtos}</strong><small>{adminMetrics.total_categorias} categorias</small></article>
        <article><span>Clientes</span><strong className="technical-data">{adminMetrics.total_usuarios}</strong><small>Contas cadastradas</small></article>
        <article><span>Itens em carrinhos</span><strong className="technical-data">{adminMetrics.itens_em_carrinhos}</strong><small>{adminMetrics.carrinhos_criados} carrinhos ativos</small></article>
      </div>}

      <div className="admin-overview-grid">
        {canReadReports && <section className="panel admin-chart" aria-labelledby="popular-products-title"><div className="panel-header"><h3 id="popular-products-title">Produtos mais adicionados</h3><Badge variant="info">Carrinhos</Badge></div>{topProducts.length > 0 ? <div className="bar-chart">{topProducts.slice(0, 6).map((product) => { const maximum = Math.max(...topProducts.map((item) => Number(item.quantidade_em_carrinhos || 0)), 1); const value = Number(product.quantidade_em_carrinhos || 0); return <div key={product.id}><span>{product.nome}</span><div><i style={{ width: `${Math.max(4, value / maximum * 100)}%` }} /><span>{value}</span></div></div>; })}</div> : <EmptyState title="Sem dados de produtos" description="Os produtos adicionados aos carrinhos aparecerão neste gráfico." />}</section>}
        <aside className="panel operational-alerts"><h3>Alertas operacionais</h3>{canReadOrders && adminOrders.some((order) => order.status === 'pending') ? <Alert variant="warning" title="Pedidos aguardando ação">Existem {adminOrders.filter((order) => order.status === 'pending').length} pedido(s) pendente(s).</Alert> : <Alert variant="success" title="Operação em dia">Nenhuma pendência crítica identificada.</Alert>}{canReadReports && Number(adminMetrics.total_estoque) === 0 && <Alert variant="warning" title="Estoque sem unidades">Revise o cadastro e a disponibilidade dos produtos.</Alert>} {!canReadReports && <p className="muted-text">Indicadores de estoque não disponíveis para sua permissão.</p>}</aside>
      </div>

      {canReadOrders && (<div className="panel nested-panel admin-recent-orders">
        <div className="panel-header"><div><span className="eyebrow">Operação</span><h3>Gestão de Pedidos</h3></div><Badge variant="neutral">{adminOrdersPagination.total || adminOrders.length} pedidos</Badge></div>
        <Filters />

        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>
              {adminOrders.map((o) => (
                <tr key={o.id}>
                  <td>{orderReference(o)}</td>
                  <td>{o.customer_name || o.customer_email}</td>
                  <td>{formatPrice(o.total)}</td>
                  <td><Badge variant={getOrderStatus(o.status, o).variant}>{getOrderStatus(o.status, o).label}</Badge></td>
                  <td>{formatDateTime(o.created_at)}</td>
                  <td>
                    <button className="ghost-button compact" type="button" onClick={() => fetchAdminOrderDetails(o.id)} disabled={loading}>Detalhes</button>
                  </td>
                </tr>
              ))}
              {adminOrders.length === 0 && <tr><td colSpan="6">Nenhum pedido encontrado para os filtros atuais.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>Pagina {adminOrdersPagination.page || 1} de {adminOrdersPagination.total_pages || 1}</span>
          <button className="ghost-button compact" type="button" onClick={() => fetchAdminOrders(adminOrderFilters, (adminOrdersPagination.page || 1) + 1)} disabled={(adminOrdersPagination.page || 1) >= (adminOrdersPagination.total_pages || 1) || loading}>Proxima</button>
        </div>

        {adminOrderDetail && (
          <div className="panel nested-panel">
            <h4>Detalhes do pedido <span className="technical-data">{orderReference(adminOrderDetail)}</span></h4>
            <p>Cliente: {adminOrderDetail.customer?.nome} ({adminOrderDetail.customer?.email})</p>
            <p>Status atual: {getOrderStatus(adminOrderDetail.status, adminOrderDetail).label}</p>
            <div className="checkout-lines">
              {adminOrderDetail.items.map((it) => (
                <div key={it.id} className="summary-card">
                  <strong>{it.nome_produto}</strong>
                  <p>Quantidade: {it.quantidade}</p>
                  <p>Valor unitário: {formatPrice(it.preco_unitario)}</p>
                </div>
              ))}
            </div>
            {canUpdateOrderStatus && <OrderStatusForm order={adminOrderDetail} loading={loading} onUpdate={updateAdminOrderStatus} />}
            <h5>Histórico</h5>
            <ul>
              {adminOrderDetail.status_history.map((h) => (
                <li key={h.id}>{formatDateTime(h.created_at)} — {getOrderStatus(h.status).label} {h.notes ? `: ${h.notes}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </div>)}
      {canReadReports && (<div className="table-wrap">
        <table>
          <thead><tr><th>Produto</th><th>Quantidade em carrinhos</th></tr></thead>
          <tbody>
            {topProducts.map((product) => (
              <tr key={product.id}><td>{product.nome}</td><td>{product.quantidade_em_carrinhos}</td></tr>
            ))}
            {topProducts.length === 0 && <tr><td colSpan="2">Nenhum dado disponivel.</td></tr>}
          </tbody>
        </table>
      </div>)}

      {canManageStoreSettings && (<div className="panel nested-panel">
        <div className="panel-header"><h3>Configuracoes da loja</h3></div>
        <form className="form-grid" onSubmit={submitSettings}>
          <label>Moeda (código)<input value={settingsForm.currency?.code || ''} onChange={(event) => setSettingsForm((current) => ({ ...current, currency: { ...current.currency, code: event.target.value } }))} /></label>
          <label>Símbolo<input value={settingsForm.currency?.symbol || ''} onChange={(event) => setSettingsForm((current) => ({ ...current, currency: { ...current.currency, symbol: event.target.value } }))} /></label>
          <label>Decimais<input type="number" min="0" max="4" value={settingsForm.currency?.decimals || 2} onChange={(event) => setSettingsForm((current) => ({ ...current, currency: { ...current.currency, decimals: Number(event.target.value) } }))} /></label>
          <label className="full-span">Métodos de pagamento (separados por vírgula)<textarea rows="3" value={(settingsForm.payment_methods || []).join(', ')} onChange={(event) => setSettingsForm((current) => ({ ...current, payment_methods: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /></label>
          <button className="primary-button" type="submit">Salvar configurações</button>
        </form>
      </div>)}

      {canReadReports && (<div className="panel nested-panel">
        <div className="panel-header"><h3>Relatorios de vendas</h3></div>
        <button className="ghost-button compact" type="button" onClick={loadSalesReport}>Gerar relatório</button>
        {salesReport && (
          <div className="checkout-lines">
            <div className="summary-card"><strong>Pedidos</strong><p>{salesReport.summary?.total_orders ?? 0}</p></div>
            <div className="summary-card"><strong>Receita</strong><p>{formatPrice(salesReport.summary?.total_revenue ?? 0)}</p></div>
            <div className="summary-card"><strong>Descontos</strong><p>{formatPrice(salesReport.summary?.total_discount ?? 0)}</p></div>
            <div className="summary-card"><strong>Frete</strong><p>{formatPrice(salesReport.summary?.total_shipping ?? 0)}</p></div>
          </div>
        )}
      </div>)}

      {canManageCoupons && (<div className="panel nested-panel">
        <div className="panel-header"><h3>Gestao de cupons</h3></div>
        <form className="form-grid" onSubmit={submitCoupon}>
          <label>Código<input value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value }))} required /></label>
          <label>Descrição<input value={couponForm.description} onChange={(event) => setCouponForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label>Tipo<select value={couponForm.discount_type} onChange={(event) => setCouponForm((current) => ({ ...current, discount_type: event.target.value }))}>
            <option value="percent">Percentual</option>
            <option value="fixed">Fixo</option>
          </select></label>
          <label>Valor<input type="number" step="0.01" value={couponForm.discount_value} onChange={(event) => setCouponForm((current) => ({ ...current, discount_value: event.target.value }))} required /></label>
          <label>Valor mínimo<input type="number" step="0.01" value={couponForm.min_order_value} onChange={(event) => setCouponForm((current) => ({ ...current, min_order_value: event.target.value }))} /></label>
          <label>Limite de uso<input type="number" min="1" value={couponForm.usage_limit} onChange={(event) => setCouponForm((current) => ({ ...current, usage_limit: event.target.value }))} /></label>
          <label>Ativo<input type="checkbox" checked={couponForm.active} onChange={(event) => setCouponForm((current) => ({ ...current, active: event.target.checked }))} /></label>
          <label>Início<input type="datetime-local" value={couponForm.starts_at} onChange={(event) => setCouponForm((current) => ({ ...current, starts_at: event.target.value }))} /></label>
          <label>Fim<input type="datetime-local" value={couponForm.ends_at} onChange={(event) => setCouponForm((current) => ({ ...current, ends_at: event.target.value }))} /></label>
          <button className="primary-button full-span" type="submit">Salvar cupom</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}><td>{coupon.code}</td><td>{coupon.discount_type}</td><td>{formatPrice(coupon.discount_value)}</td><td>{coupon.active ? 'Ativo' : 'Inativo'}</td></tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan="4">Nenhum cupom cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>)}

      {canReadCustomers && (<div className="panel nested-panel">
        <div className="panel-header"><h3>Gestao de clientes</h3></div>
        <form className="filters-grid customer-search" onSubmit={(event) => { event.preventDefault(); fetchCustomers(customerSearch); }}>
          <label className="full-span">Buscar cliente<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nome ou email" /></label>
          <button className="primary-button" type="submit">Pesquisar</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Email</th><th>Pedidos</th><th>Gasto</th><th>Ações</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.nome}</td>
                  <td>{customer.email}</td>
                  <td>{customer.total_pedidos}</td>
                  <td>{formatPrice(customer.total_gasto)}</td>
                  <td><button className="ghost-button compact" type="button" onClick={() => fetchCustomerDetails(customer.id)}>Detalhes</button></td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan="5">Nenhum cliente encontrado.</td></tr>}
            </tbody>
          </table>
        </div>

        {customerDetail && (
          <div className="checkout-grid">
            {canWriteCustomers ? <form className="form-grid checkout-panel" onSubmit={submitCustomerEdit}>
              <label>Nome<input name="nome" value={customerEditForm.nome} onChange={onCustomerEditChange} required /></label>
              <label>Email<input name="email" type="email" value={customerEditForm.email} onChange={onCustomerEditChange} required /></label>
              <label className="full-span">Endereco<textarea name="endereco" rows="4" value={customerEditForm.endereco} onChange={onCustomerEditChange} /></label>
              <button className="primary-button" type="submit" disabled={loading}>Salvar cliente</button>
            </form> : <aside className="panel nested-panel"><p className="muted-text">Sem permissao para editar este cliente.</p></aside>}
            <aside className="panel nested-panel">
              <h3>Resumo do cliente</h3>
              <p>Total de pedidos: {customerDetail.customer.total_pedidos}</p>
              <p>Gasto total: {formatPrice(customerDetail.customer.total_gasto)}</p>
              <p>Enderecos: {customerDetail.customer.total_enderecos}</p>
              <h3>Ultimos pedidos</h3>
              <div className="checkout-lines">
                {customerDetail.orders.map((order) => (
                  <div key={order.id} className="summary-card">
                    <strong className="technical-data">Pedido {orderReference(order)}</strong>
                    <p>Status: {getOrderStatus(order.status, order).label}</p>
                    <p>Total: {formatPrice(order.total)}</p>
                    <p>Data: {formatDateTime(order.created_at)}</p>
                  </div>
                ))}
                {customerDetail.orders.length === 0 && <p className="muted-text">Sem pedidos registrados.</p>}
              </div>
            </aside>
          </div>
        )}
      </div>)}

    </section>
  );
}
