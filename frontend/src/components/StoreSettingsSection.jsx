import { useEffect, useState } from 'react';
import Button from './ui/Button';
import { clearStoreInfoCache, EMPTY_STORE_INFO } from '../hooks/useStoreInfo';

const empty = { pickup: EMPTY_STORE_INFO.pickup, contact: EMPTY_STORE_INFO.contact, policies: EMPTY_STORE_INFO.policies, shipping: { free_shipping_min: 0 }, sender: { name: '', document: '', address: '', zip_code: '', phone: '' } };

export default function StoreSettingsSection({ token, showToast }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(true);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/admin/store-info', { headers }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setForm({ ...empty, ...data.store_info, sender: { ...empty.sender, ...data.store_info?.sender } });
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
    <form className="branding-editor store-settings-form" onSubmit={save}>
      <section className="branding-card"><header className="branding-card-header"><h3>Retirada na loja</h3><p>Endereço, horário e instruções para quem busca o pedido no balcão.</p></header>
        <label className="checkbox-row"><input type="checkbox" checked={form.pickup.enabled} onChange={set('pickup', 'enabled')} /> Oferecer retirada na loja (frete grátis)</label>
        <label>Endereço<input value={form.pickup.address} maxLength="300" onChange={set('pickup', 'address')} placeholder="Rua, número, bairro, cidade/UF" /></label>
        <label>Horário<input value={form.pickup.hours} maxLength="300" onChange={set('pickup', 'hours')} placeholder="Seg a sex, 9h às 18h; sáb, 9h às 13h" /></label>
        <label>Instruções<textarea value={form.pickup.instructions} maxLength="500" onChange={set('pickup', 'instructions')} placeholder="Apresente documento com foto e o número do pedido." /></label>
      </section>
      <section className="branding-card"><header className="branding-card-header"><h3>Entrega</h3><p>Deixe o valor vazio para não oferecer frete grátis. O carrinho mostra quanto falta para o cliente ganhar o benefício.</p></header>
        <label>Frete grátis a partir de (R$)<input type="number" min="0" step="0.01" value={form.shipping.free_shipping_min || ''} onChange={set('shipping', 'free_shipping_min')} placeholder="0,00" /></label>
      </section>
      <section className="branding-card"><header className="branding-card-header"><h3>Remetente das etiquetas</h3><p>Impresso nas etiquetas de envio. Com CNPJ, a razão social e o endereço também aparecem no rodapé da loja. Campos vazios usam o nome da loja, o endereço de retirada e o telefone de atendimento.</p></header>
        <label>Razão social ou nome<input value={form.sender.name} maxLength="120" onChange={set('sender', 'name')} placeholder="Território do Couro LTDA" /></label>
        <label>CNPJ ou CPF<input value={form.sender.document} maxLength="20" onChange={set('sender', 'document')} placeholder="00.000.000/0001-00" /></label>
        <label>Endereço completo<input value={form.sender.address} maxLength="300" onChange={set('sender', 'address')} placeholder="Rua, número, bairro, cidade/UF" /></label>
        <label>CEP<input value={form.sender.zip_code} maxLength="9" inputMode="numeric" onChange={set('sender', 'zip_code')} placeholder="00000-000" /></label>
        <label>Telefone<input value={form.sender.phone} maxLength="30" onChange={set('sender', 'phone')} /></label>
      </section>
      <section className="branding-card"><header className="branding-card-header"><h3>Atendimento</h3><p>Com o WhatsApp preenchido, a loja exibe um botão flutuante de atendimento.</p></header>
        <label>E-mail<input type="email" value={form.contact.email} maxLength="254" onChange={set('contact', 'email')} /></label>
        <label>Telefone<input value={form.contact.phone} maxLength="30" onChange={set('contact', 'phone')} /></label>
        <label>WhatsApp<input value={form.contact.whatsapp} maxLength="30" onChange={set('contact', 'whatsapp')} /></label>
      </section>
      <section className="branding-card"><header className="branding-card-header"><h3>Políticas</h3><p>Texto simples. As páginas aparecem no rodapé da loja assim que forem preenchidas.</p></header>
        <label>Trocas e devoluções<textarea rows="8" value={form.policies.exchanges} maxLength="20000" onChange={set('policies', 'exchanges')} /></label>
        <label>Política de privacidade<textarea rows="8" value={form.policies.privacy} maxLength="20000" onChange={set('policies', 'privacy')} /></label>
      </section>
      <Button type="submit" loading={busy} loadingLabel="Salvando…">Salvar dados da loja</Button>
    </form>
  </section>;
}
