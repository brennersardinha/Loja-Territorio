import React from 'react';
import { PERMISSIONS } from '../../config/permissions';
import { useAuth } from '../../contexts/AuthContext';
import { getOrderStatus, orderReference } from '../../config/orderStatus';
import AdminPageHeader from './AdminPageHeader';

// Clientes: busca, histórico de compras e edição do cadastro.
export default function CustomersSection({ customerSearch, setCustomerSearch, fetchCustomers, customers, fetchCustomerDetails, customerDetail, customerEditForm, submitCustomerEdit, onCustomerEditChange, loading, formatPrice, formatDateTime }) {
  const { hasPermission } = useAuth();
  const canWriteCustomers = hasPermission(PERMISSIONS.CUSTOMERS_WRITE);
  const detailRef = React.useRef(null);

  React.useEffect(() => { fetchCustomers(customerSearch); }, []);
  React.useEffect(() => { if (customerDetail) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [customerDetail?.customer?.id]);

  return (
    <section className="admin-page">
      <AdminPageHeader group="Vendas" title="Clientes" description="Encontre clientes, veja o histórico de compras e corrija dados de cadastro." />
      <div className="panel admin-panel">
        <form className="filters-grid customer-search" onSubmit={(event) => { event.preventDefault(); fetchCustomers(customerSearch); }}>
          <label className="full-span">Buscar cliente<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nome ou email" /></label>
          <button className="primary-button" type="submit" disabled={loading}>Pesquisar</button>
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
      </div>

      {customerDetail && (
        <div ref={detailRef} className="checkout-grid">
          {canWriteCustomers ? <form className="form-grid panel admin-panel" onSubmit={submitCustomerEdit}>
            <h3 className="full-span">Cadastro</h3>
            <label>Nome<input name="nome" value={customerEditForm.nome} onChange={onCustomerEditChange} required /></label>
            <label>Email<input name="email" type="email" value={customerEditForm.email} onChange={onCustomerEditChange} required /></label>
            <button className="primary-button" type="submit" disabled={loading}>Salvar cliente</button>
          </form> : <aside className="panel admin-panel"><p className="muted-text">Sem permissão para editar este cliente.</p></aside>}
          <aside className="panel admin-panel">
            <h3>Resumo do cliente</h3>
            <p>Total de pedidos: {customerDetail.customer.total_pedidos}</p>
            <p>Gasto total: {formatPrice(customerDetail.customer.total_gasto)}</p>
            <p>Endereços: {customerDetail.customer.total_enderecos}</p>
            <h4>Últimos pedidos</h4>
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
    </section>
  );
}
