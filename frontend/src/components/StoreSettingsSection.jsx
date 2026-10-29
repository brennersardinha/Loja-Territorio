import { useEffect, useState } from 'react';
import Button from './ui/Button';
import { clearStoreInfoCache, EMPTY_STORE_INFO } from '../hooks/useStoreInfo';

const empty = { pickup: EMPTY_STORE_INFO.pickup, contact: EMPTY_STORE_INFO.contact, policies: EMPTY_STORE_INFO.policies };

export default function StoreSettingsSection({ token, showToast }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(true);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/admin/store-info', { headers }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setForm({ ...empty, ...data.store_info });
    }).catch((error) => showToast(error.message, 'error')).finally(() => setBusy(false));
  }, [token]);

  const set = (group, key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/store-info', { method: 'PUT', headers, body: JSON.stringify({ store_info: form }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.errors?.join(' ') || data.error || 'Operação não concluída.');
      setForm({ ...empty, ...data.store_info });
      clearStoreInfoCache();
      showToast('Dados da loja salvos.', 'success');
    } catch (error) { showToast(error.message, 'error'); } finally { setBusy(false); }
  }

  return <section className="branding-page"><div className="panel-header"><div><span className="eyebrow">Loja física</span><h2>Dados da loja</h2><p className="muted-text">Retirada no balcão, contatos e políticas exibidos na vitrine.</p></div></div>
    <form className="form-grid" onSubmit={save}>
      <fieldset className="panel form-grid"><legend>Retirada na loja</legend>
        <label className="checkbox-row"><input type="checkbox" checked={form.pickup.enabled} onChange={set('pickup', 'enabled')} /> Oferecer retirada na loja (frete grátis)</label>
        <label>Endereço<input value={form.pickup.address} maxLength="300" onChange={set('pickup', 'address')} placeholder="Rua, número, bairro, cidade/UF" /></label>
        <label>Horário<input value={form.pickup.hours} maxLength="300" onChange={set('pickup', 'hours')} placeholder="Seg a sex, 9h às 18h; sáb, 9h às 13h" /></label>
        <label>Instruções<textarea value={form.pickup.instructions} maxLength="500" onChange={set('pickup', 'instructions')} placeholder="Apresente documento com foto e o número do pedido." /></label>
      </fieldset>
      <fieldset className="panel form-grid"><legend>Atendimento</legend>
        <label>E-mail<input type="email" value={form.contact.email} maxLength="254" onChange={set('contact', 'email')} /></label>
        <label>Telefone<input value={form.contact.phone} maxLength="30" onChange={set('contact', 'phone')} /></label>
        <label>WhatsApp<input value={form.contact.whatsapp} maxLength="30" onChange={set('contact', 'whatsapp')} /></label>
      </fieldset>
      <fieldset className="panel form-grid"><legend>Políticas</legend>
        <label>Trocas e devoluções<textarea rows="8" value={form.policies.exchanges} maxLength="20000" onChange={set('policies', 'exchanges')} /></label>
        <label>Política de privacidade<textarea rows="8" value={form.policies.privacy} maxLength="20000" onChange={set('policies', 'privacy')} /></label>
        <small className="muted-text">Texto simples. As páginas aparecem no rodapé da loja assim que forem preenchidas.</small>
      </fieldset>
      <Button type="submit" loading={busy} loadingLabel="Salvando…">Salvar dados da loja</Button>
    </form>
  </section>;
}
