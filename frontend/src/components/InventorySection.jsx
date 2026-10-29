import { useEffect, useState } from 'react';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';

// Integracao com o sistema de estoque da loja fisica (ESPECIFICACAO-ESTOQUE.md):
// chaves da API de sincronizacao e endpoints que recebem os webhooks de pedido.
export default function InventorySection({ token, showToast }) {
  const [keys, setKeys] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [events, setEvents] = useState([]);
  const [keyName, setKeyName] = useState('');
  const [hook, setHook] = useState({ url: '', description: '', events: [] });
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function call(url, options = {}) {
    const response = await fetch(url, { headers, ...options });
    const data = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw Error(data.error || 'Operação não concluída.');
    return data;
  }
  async function load() {
    const [keyData, hookData, eventData] = await Promise.all([call('/api/admin/inventory/api-keys'), call('/api/admin/webhooks'), call('/api/admin/webhooks/events')]);
    setKeys(keyData.keys || []); setEndpoints(hookData.endpoints || []); setEvents(eventData.events || []);
  }
  useEffect(() => { load().catch((error) => showToast(error.message, 'error')); }, [token]);

  async function run(action, message) {
    setBusy(true);
    try { await action(); await load(); if (message) showToast(message, 'success'); } catch (error) { showToast(error.message, 'error'); } finally { setBusy(false); }
  }
  const createKey = (event) => { event.preventDefault(); run(async () => { const data = await call('/api/admin/inventory/api-keys', { method: 'POST', body: JSON.stringify({ name: keyName }) }); setSecret({ label: `Chave "${data.api_key.name}"`, value: data.key }); setKeyName(''); }); };
  const toggleKey = (key) => run(() => call(`/api/admin/inventory/api-keys/${key.id}`, { method: 'PATCH', body: JSON.stringify({ active: !key.active }) }), key.active ? 'Chave revogada.' : 'Chave reativada.');
  const createHook = (event) => { event.preventDefault(); run(async () => { const data = await call('/api/admin/webhooks', { method: 'POST', body: JSON.stringify(hook) }); setSecret({ label: `Segredo do webhook ${data.endpoint.url}`, value: data.secret }); setHook({ url: '', description: '', events: [] }); }); };
  const toggleEvent = (name) => setHook((current) => ({ ...current, events: current.events.includes(name) ? current.events.filter((item) => item !== name) : [...current.events, name] }));

  return <section className="branding-page"><div className="panel-header"><div><span className="eyebrow">Sistema de estoque</span><h2>Estoque e webhooks</h2><p className="muted-text">Credenciais para o sistema da loja física sincronizar saldos e receber os pedidos online.</p></div></div>
    {secret && <Alert variant="warning" title={`${secret.label}: copie agora`}>Este valor não será exibido novamente. Guarde-o no cofre do sistema de estoque.<br /><code className="technical-data">{secret.value}</code><br /><Button size="sm" variant="ghost" onClick={() => setSecret(null)}>Já copiei</Button></Alert>}
    <div className="branding-layout">
      <section className="panel form-grid"><h3>Chaves da API de sincronização</h3>
        <form className="form-grid" onSubmit={createKey}><label>Nome da chave<input required maxLength="120" value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="PDV loja centro" /></label><Button type="submit" loading={busy}>Gerar chave</Button></form>
        {keys.length ? keys.map((key) => <div className="saved-address" key={key.id}><span><strong>{key.name}</strong><small className="technical-data">{key.key_prefix}… · {key.last_used_at ? `último uso ${new Date(key.last_used_at).toLocaleString('pt-BR')}` : 'nunca usada'}</small></span><Badge variant={key.active ? 'success' : 'neutral'}>{key.active ? 'Ativa' : 'Revogada'}</Badge><Button size="sm" variant={key.active ? 'danger' : 'ghost'} onClick={() => toggleKey(key)} disabled={busy}>{key.active ? 'Revogar' : 'Reativar'}</Button></div>) : <EmptyState title="Nenhuma chave" description="Gere uma chave quando o sistema de estoque estiver pronto." />}
        <small className="muted-text">Com uma chave ativa, o SKU passa a ser obrigatório no cadastro de produtos.</small>
      </section>
      <section className="panel form-grid"><h3>Webhooks de pedido</h3>
        <form className="form-grid" onSubmit={createHook}><label>URL HTTPS do sistema de estoque<input type="url" required value={hook.url} onChange={(event) => setHook({ ...hook, url: event.target.value })} placeholder="https://estoque.minhaloja.com.br/webhooks" /></label><label>Descrição<input maxLength="180" value={hook.description} onChange={(event) => setHook({ ...hook, description: event.target.value })} /></label><fieldset><legend>Eventos</legend>{events.map((name) => <label key={name} className="checkbox-row"><input type="checkbox" checked={hook.events.includes(name)} onChange={() => toggleEvent(name)} /> <span className="technical-data">{name}</span></label>)}</fieldset><Button type="submit" loading={busy} disabled={!hook.events.length}>Cadastrar webhook</Button></form>
        {endpoints.length ? endpoints.map((endpoint) => <div className="saved-address" key={endpoint.id}><span><strong className="technical-data">{endpoint.url}</strong><small>{(endpoint.events || []).join(', ')}</small></span><Button size="sm" variant="ghost" onClick={() => run(() => call(`/api/admin/webhooks/${endpoint.id}/test`, { method: 'POST' }), 'Evento de teste enfileirado.')} disabled={busy || !endpoint.active}>Testar</Button><Button size="sm" variant="danger" onClick={() => run(() => call(`/api/admin/webhooks/${endpoint.id}`, { method: 'DELETE' }), 'Webhook removido.')} disabled={busy}>Remover</Button></div>) : <EmptyState title="Nenhum webhook" description="Cadastre o endereço que receberá os pedidos online." />}
      </section>
    </div>
  </section>;
}
