import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import AdminPageHeader from './AdminPageHeader';
import { parseAdminResponse } from './adminApi';

const EMPTY_COUPON = { code: '', description: '', discount_type: 'percent', discount_value: '', min_order_value: '0', usage_limit: '', active: true, starts_at: '', ends_at: '' };

// Cupons: cadastro e lista dos cupons de desconto.
export default function CouponsSection({ token, formatPrice }) {
  const { showToast } = useToast();
  const [coupons, setCoupons] = React.useState([]);
  const [form, setForm] = React.useState(EMPTY_COUPON);
  const [busy, setBusy] = React.useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  React.useEffect(() => {
    fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => parseAdminResponse(response, 'Falha ao carregar cupons.'))
      .then((data) => setCoupons(data.items || []))
      .catch((error) => showToast(error.message, 'error'));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, discount_value: Number(form.discount_value), min_order_value: Number(form.min_order_value || 0), usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit), active: Boolean(form.active) };
      const response = await fetch('/api/admin/coupons', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await parseAdminResponse(response, 'Falha ao criar cupom.');
      setCoupons((current) => [data.coupon, ...current]);
      setForm(EMPTY_COUPON);
      showToast('Cupom cadastrado.', 'success');
    } catch (error) { showToast(error.message, 'error'); } finally { setBusy(false); }
  }

  const couponValue = (coupon) => (coupon.discount_type === 'percent' ? `${Number(coupon.discount_value)}%` : formatPrice(coupon.discount_value));

  return (
    <section className="admin-page">
      <AdminPageHeader group="Marketing" title="Cupons" description="Crie cupons de desconto com valor mínimo, limite de uso e período de validade." />
      <form className="panel admin-panel form-grid" onSubmit={submit}>
        <h3 className="full-span">Novo cupom</h3>
        <label>Código<input value={form.code} onChange={set('code')} required /></label>
        <label>Descrição<input value={form.description} onChange={set('description')} /></label>
        <label>Tipo<select value={form.discount_type} onChange={set('discount_type')}><option value="percent">Percentual</option><option value="fixed">Valor fixo</option></select></label>
        <label>Valor<input type="number" step="0.01" value={form.discount_value} onChange={set('discount_value')} required /></label>
        <label>Valor mínimo do pedido<input type="number" step="0.01" value={form.min_order_value} onChange={set('min_order_value')} /></label>
        <label>Limite de uso<input type="number" min="1" value={form.usage_limit} onChange={set('usage_limit')} placeholder="Sem limite" /></label>
        <label>Início<input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} /></label>
        <label>Fim<input type="datetime-local" value={form.ends_at} onChange={set('ends_at')} /></label>
        <label className="checkbox-row full-span"><input type="checkbox" checked={form.active} onChange={set('active')} /> Cupom ativo</label>
        <button className="primary-button full-span" type="submit" disabled={busy}>Salvar cupom</button>
      </form>
      <div className="panel admin-panel">
        <h3>Cupons cadastrados</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {coupons.map((coupon) => <tr key={coupon.id}><td className="technical-data">{coupon.code}</td><td>{coupon.discount_type === 'percent' ? 'Percentual' : 'Valor fixo'}</td><td>{couponValue(coupon)}</td><td>{coupon.active ? 'Ativo' : 'Inativo'}</td></tr>)}
              {coupons.length === 0 && <tr><td colSpan="4">Nenhum cupom cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
