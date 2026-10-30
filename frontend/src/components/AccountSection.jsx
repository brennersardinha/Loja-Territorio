import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Button from './ui/Button';
import Field from './ui/Field';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import AddressForm from './AddressForm';
import { getOrderStatus, orderReference } from '../config/orderStatus';

export default function AccountSection({
  user,
  isRegister,
  mode,
  setMode,
  authForm,
  profileForm,
  onAuthFormChange,
  onProfileFormChange,
  submitAuth,
  requestPasswordReset,
  resetPassword,
  submitProfile,
  loading,
  status,
  formatPrice,
  formatDateTime,
  userOrders,
  fetchUserOrders,
  userOrderDetail,
  userOrderTracking,
  fetchUserOrderTracking,
  addresses = [],
  addressForm,
  setAddressForm,
  submitAddress,
  removeAddress,
  setDefaultAddress,
}) {
  const [accountView, setAccountView] = useState('profile');
  const [resetForm, setResetForm] = useState({ senha: '', confirmacao: '' });
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressToRemove, setAddressToRemove] = useState(null);
  const saveAddress = async (event) => { if (await submitAddress(event)) setAddingAddress(false); };
  const confirmRemoveAddress = async () => { await removeAddress(addressToRemove.id); setAddressToRemove(null); };
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  async function submitRecovery(event) {
    event.preventDefault();
    if (isForgot) return requestPasswordReset(authForm.email);
    if (resetForm.senha !== resetForm.confirmacao) return;
    const completed = await resetPassword(resetForm.senha);
    if (completed) setResetForm({ senha: '', confirmacao: '' });
  }
  return (
    <section className={`panel auth-panel ${user ? 'account-page' : ''}`}>
      <div className="panel-header">
        <h2>{user ? 'Perfil' : isForgot ? 'Recuperar senha' : isReset ? 'Criar nova senha' : isRegister ? 'Cadastro' : 'Login'}</h2>
        {!user && !isForgot && !isReset && (
          <div className="segmented-control" aria-label="Alternar formulário">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Cadastro</button>
          </div>
        )}
      </div>

      {status && <p className="muted-text" role="status" aria-live="polite">{status}</p>}

      {!user && (isForgot || isReset) ? <form className="form-grid" onSubmit={submitRecovery}>{isForgot ? <Field label="E-mail" name="email" type="email" value={authForm.email} onChange={onAuthFormChange} autoComplete="email" required /> : <><Field label="Nova senha" name="nova-senha" type="password" value={resetForm.senha} onChange={(event) => setResetForm({ ...resetForm, senha: event.target.value })} minLength="12" autoComplete="new-password" required /><Field label="Confirmar nova senha" name="confirmar-senha" type="password" value={resetForm.confirmacao} onChange={(event) => setResetForm({ ...resetForm, confirmacao: event.target.value })} minLength="12" autoComplete="new-password" required />{resetForm.confirmacao && resetForm.senha !== resetForm.confirmacao && <p className="error-message" role="alert">As senhas não coincidem.</p>}</>}<Button type="submit" loading={loading} disabled={isReset && resetForm.senha !== resetForm.confirmacao}>{isForgot ? 'Enviar link' : 'Redefinir senha'}</Button>{isForgot && <Button type="button" variant="ghost" onClick={() => setMode('login')}>Voltar ao login</Button>}</form> : !user ? (
        <form className="form-grid" onSubmit={submitAuth}>
          {isRegister && <Field label="Nome" name="nome" value={authForm.nome} onChange={onAuthFormChange} minLength="2" autoComplete="name" required />}
          <Field label="E-mail" name="email" type="email" value={authForm.email} onChange={onAuthFormChange} autoComplete="email" required />
          <Field label="Senha" hint={isRegister ? 'Use pelo menos 6 caracteres.' : undefined} name="senha" type="password" value={authForm.senha} onChange={onAuthFormChange} minLength="6" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
          {!isRegister && <button className="password-reset-link" type="button" onClick={() => setMode('forgot')}>Esqueci minha senha</button>}
          <Button type="submit" loading={loading} loadingLabel="Processando…">{isRegister ? 'Criar conta' : 'Entrar'}</Button>
        </form>
      ) : (
        <>
          <nav className="account-navigation" aria-label="Minha conta"><button className={accountView === 'profile' ? 'active' : ''} type="button" onClick={() => setAccountView('profile')}>Perfil</button><button className={accountView === 'orders' ? 'active' : ''} type="button" onClick={() => { setAccountView('orders'); fetchUserOrders(1, 10); }}>Pedidos</button><button className={accountView === 'addresses' ? 'active' : ''} type="button" onClick={() => setAccountView('addresses')}>Endereços</button><NavLink to="/desejos">Lista de desejos</NavLink></nav>
          {accountView === 'profile' && <section className="account-content" aria-labelledby="profile-title"><div className="account-section-heading"><div><span className="eyebrow">Dados pessoais</span><h3 id="profile-title">Informações do perfil</h3></div><span className="account-avatar" aria-hidden="true">{(profileForm.nome || user.nome || 'U').slice(0, 1).toUpperCase()}</span></div>
          <form className="form-grid" onSubmit={submitProfile}>
            <Field label="Nome" name="nome" value={profileForm.nome} onChange={onProfileFormChange} minLength="2" autoComplete="name" required />
            <Field label="E-mail" name="email" type="email" value={profileForm.email} onChange={onProfileFormChange} autoComplete="email" required />
            <Button type="submit" loading={loading} loadingLabel="Salvando…">Salvar perfil</Button>
          </form>
          </section>}

          {accountView === 'addresses' && <section className="account-content" aria-labelledby="addresses-title">
            <div className="panel-header"><div><span className="eyebrow">Entrega</span><h3 id="addresses-title">Meus endereços</h3></div>{!addingAddress && addresses.length > 0 && <Button variant="ghost" size="sm" onClick={() => setAddingAddress(true)}>+ Novo endereço</Button>}</div>
            {(addingAddress || addresses.length === 0) && <AddressForm addressForm={addressForm} setAddressForm={setAddressForm} onSubmit={saveAddress} onCancel={addresses.length > 0 ? () => setAddingAddress(false) : null} loading={loading} defaultRecipient={user?.nome} submitLabel="Salvar endereço" />}
            {!addingAddress && <ul className="address-list">{addresses.map((address) => <li key={address.id} className="address-card"><div><strong>{address.street}{address.number ? `, ${address.number}` : ''}{address.complement ? ` · ${address.complement}` : ''}</strong><small>{[address.neighborhood, `${address.city}/${address.state}`, address.zip_code].filter(Boolean).join(' · ')}</small><small>Recebe: {address.recipient_name}</small>{address.is_default && <Badge variant="success">Padrão</Badge>}</div><div className="address-card-actions">{!address.is_default && <Button variant="ghost" size="sm" onClick={() => setDefaultAddress(address)}>Tornar padrão</Button>}<Button variant="ghost" size="sm" onClick={() => setAddressToRemove(address)} aria-label={`Remover endereço ${address.street}`}>Remover</Button></div></li>)}</ul>}
            <Modal open={Boolean(addressToRemove)} title="Remover endereço?" description={addressToRemove ? `${addressToRemove.street}${addressToRemove.number ? `, ${addressToRemove.number}` : ''} deixará de aparecer no checkout.` : ''} confirmLabel="Remover endereço" danger loading={loading} onClose={() => setAddressToRemove(null)} onConfirm={confirmRemoveAddress} />
          </section>}

          {accountView === 'orders' && <section className="account-content" aria-labelledby="orders-title">
            <div className="panel-header"><div><span className="eyebrow">Suas compras</span><h3 id="orders-title">Histórico de pedidos</h3></div><Button variant="ghost" size="sm" onClick={() => fetchUserOrders(1, 10)}>Atualizar</Button></div>
            <div className="account-orders">
              {userOrders.map((order) => (
                <article key={order.id} className="account-order-card">
                  <div><strong className="technical-data">Pedido {orderReference(order)}</strong><Badge variant={getOrderStatus(order.status, order).variant}>{getOrderStatus(order.status, order).label}</Badge></div>
                  <p className="muted-text">{getOrderStatus(order.status, order).description}</p>
                  <p>Total: {formatPrice(order.total)}</p>
                  <p>Data: {formatDateTime(order.created_at)}</p>
                  <Button variant="ghost" size="sm" onClick={() => fetchUserOrderTracking(order.id)}>Ver detalhes e rastreio</Button>
                </article>
              ))}
              {userOrders.length === 0 && <EmptyState title="Nenhum pedido encontrado" description="Quando você concluir uma compra, ela aparecerá aqui." actionLabel="Explorar produtos" onAction={() => { window.location.href = '/buscar'; }} />}
            </div>

            {userOrderDetail && (
              <div className="panel nested-panel order-detail-card">
                <h4>Detalhes do pedido <span className="technical-data">{orderReference(userOrderDetail)}</span></h4>
                <p>Status atual: {getOrderStatus(userOrderDetail.status, userOrderDetail).label}</p>
                <h5>Histórico</h5>
                <ul>
                  {(userOrderTracking?.status_history || []).map((item) => (
                    <li key={item.id}>{formatDateTime(item.created_at)} — {getOrderStatus(item.status).label} {item.notes ? `: ${item.notes}` : ''}</li>
                  ))}
                </ul>
                <h5>Tracking</h5>
                <ul>
                  {(userOrderTracking?.tracking || []).map((item) => (
                    <li key={item.id}>{item.carrier || 'Transportadora'} — {item.tracking_code || 'Sem código'} — {item.status || 'Sem status'}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>}
        </>
      )}
    </section>
  );
}
