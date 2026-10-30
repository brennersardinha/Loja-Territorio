import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import AdminPageHeader from './AdminPageHeader';
import { parseAdminResponse } from './adminApi';

const DEFAULT_SETTINGS = { currency: { code: 'BRL', symbol: 'R$', decimals: 2 }, tax_rates: [], shipping_methods: [], payment_methods: ['pix', 'boleto', 'cartao'] };

// Moeda e pagamento: configurações gerais de cobrança da loja.
export default function PaymentSettingsSection({ token }) {
  const { showToast } = useToast();
  const [form, setForm] = React.useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = React.useState(true);
  const setCurrency = (key, parse = (value) => value) => (event) => setForm((current) => ({ ...current, currency: { ...current.currency, [key]: parse(event.target.value) } }));

  React.useEffect(() => {
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => parseAdminResponse(response, 'Falha ao carregar configurações.'))
      .then(({ settings = {} }) => setForm({ ...DEFAULT_SETTINGS, ...settings, currency: settings.currency || DEFAULT_SETTINGS.currency, payment_methods: settings.payment_methods || DEFAULT_SETTINGS.payment_methods }))
      .catch((error) => showToast(error.message, 'error'))
      .finally(() => setBusy(false));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/settings', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      await parseAdminResponse(response, 'Falha ao salvar configurações.');
      showToast('Configurações atualizadas.', 'success');
    } catch (error) { showToast(error.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader group="Loja" title="Moeda e pagamento" description="Moeda usada nos preços e meios de pagamento aceitos." />
      <form className="panel admin-panel form-grid" onSubmit={submit}>
        <label>Moeda (código)<input value={form.currency?.code || ''} onChange={setCurrency('code')} /></label>
        <label>Símbolo<input value={form.currency?.symbol || ''} onChange={setCurrency('symbol')} /></label>
        <label>Casas decimais<input type="number" min="0" max="4" value={form.currency?.decimals ?? 2} onChange={setCurrency('decimals', Number)} /></label>
        <label className="full-span">Métodos de pagamento (separados por vírgula)<textarea rows="3" value={(form.payment_methods || []).join(', ')} onChange={(event) => setForm((current) => ({ ...current, payment_methods: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} /></label>
        <button className="primary-button" type="submit" disabled={busy}>Salvar configurações</button>
      </form>
    </section>
  );
}
