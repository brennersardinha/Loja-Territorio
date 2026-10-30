import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Barcode from './ui/Barcode';
import { useBranding } from '../contexts/BrandingContext';

const DOCUMENTS = [['ambos', 'Envio e separação'], ['envio', 'Só etiqueta de envio'], ['separacao', 'Só ficha de separação']];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');
const formatWeight = (value) => (value ? `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : '—');

async function parseResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
  return data;
}

// Etiqueta 10×15 cm de identificação do volume: destinatário em destaque, remetente e código único do volume.
export function ShippingLabel({ payload, volume, logo }) {
  const { label, order, recipient, sender, tracking } = payload;
  const volumeCode = `${label.code}-${volume}`;
  return (
    <article className="shipping-label label-page" aria-label={`Etiqueta de envio ${volumeCode}`}>
      <header className="label-header">
        <div className="label-brand">{logo && <img src={logo} alt="" />}<strong>{sender.name}</strong></div>
        <div className={`label-service ${order.is_pickup ? 'pickup' : ''}`}><small>Serviço</small><strong>{order.service}</strong></div>
      </header>
      <section className="label-recipient">
        <span className="label-caption">Destinatário</span>
        <strong className="label-recipient-name">{recipient.name}</strong>
        {order.is_pickup ? <p>Retirar no balcão da loja com o número do pedido.</p> : <>
          <p>{[recipient.street, recipient.number].filter(Boolean).join(', ')}{recipient.complement ? ` — ${recipient.complement}` : ''}</p>
          {recipient.neighborhood && <p>{recipient.neighborhood}</p>}
          <p>{[recipient.city, recipient.state].filter(Boolean).join(' / ')}</p>
          {recipient.zip_code && <p className="label-zip">CEP {recipient.zip_code}</p>}
        </>}
      </section>
      <section className="label-facts">
        <div><small>Pedido</small><strong>{order.reference}</strong></div>
        <div><small>Volume</small><strong>{volume}/{label.volumes}</strong></div>
        <div><small>Peso{label.weight_is_estimate ? ' (est.)' : ''}</small><strong>{formatWeight(label.weight_kg)}</strong></div>
        <div><small>Data</small><strong>{formatDate(order.created_at)}</strong></div>
      </section>
      <Barcode value={volumeCode} height={56} className="label-barcode" />
      {tracking && <div className="label-tracking"><small>Rastreio {tracking.carrier}</small><Barcode value={tracking.code} height={34} /></div>}
      <footer className="label-sender">
        <span className="label-caption">Remetente</span>
        <strong>{sender.name}</strong>
        {sender.document && <span>CNPJ/CPF {sender.document}</span>}
        <span>{sender.address}{sender.zip_code ? ` · CEP ${sender.zip_code}` : ''}</span>
        {sender.phone && <span>Tel. {sender.phone}</span>}
      </footer>
    </article>
  );
}

// Ficha de separação: o que pegar no estoque, com caixa para marcar e espaço para conferência.
export function PickingSlip({ payload }) {
  const { label, order, recipient, items } = payload;
  return (
    <article className="picking-slip label-page" aria-label={`Ficha de separação ${label.code}`}>
      <header className="label-header">
        <div><span className="label-caption">Ficha de separação</span><strong className="picking-order">{order.reference}</strong><small>{recipient.name} · {order.service}</small></div>
        <Barcode value={label.code} height={40} className="picking-barcode" />
      </header>
      <table className="picking-items">
        <thead><tr><th aria-label="Separado" /><th>Qtd.</th><th>Produto</th><th>SKU</th></tr></thead>
        <tbody>{items.map((item, index) => <tr key={`${item.sku}-${index}`}><td><span className="picking-check" aria-hidden="true" /></td><td><strong>{item.quantity}</strong> <small>{item.unit}</small></td><td>{item.name}</td><td>{item.sku || '—'}</td></tr>)}</tbody>
      </table>
      <p className="picking-total">{order.items_count} {order.items_count === 1 ? 'item' : 'itens'} · {label.volumes} {label.volumes === 1 ? 'volume' : 'volumes'} · {formatWeight(label.weight_kg)}</p>
      <footer className="picking-sign"><span>Separado por: __________________</span><span>Conferido por: _________________</span></footer>
    </article>
  );
}

export default function LabelsPrintPage({ token }) {
  const [searchParams] = useSearchParams();
  const { branding } = useBranding();
  const orderIds = useMemo(() => (searchParams.get('pedidos') || '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0), [searchParams]);
  const [documentType, setDocumentType] = useState(searchParams.get('tipo') || 'ambos');
  const [labels, setLabels] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!orderIds.length) { setError('Nenhum pedido selecionado.'); setLoading(false); return; }
    setLoading(true);
    fetch('/api/admin/labels', { method: 'POST', headers, body: JSON.stringify({ order_ids: orderIds }) })
      .then(parseResponse)
      .then((data) => {
        setLabels(data.labels || []); setSkipped(data.skipped || []); setError('');
        setDrafts(Object.fromEntries((data.labels || []).map(({ order, label }) => [order.id, { volumes: label.volumes, weight_kg: label.weight_is_estimate ? '' : label.weight_kg }])));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [orderIds.join(','), token]);

  // Após a impressão, registra quantas vezes cada etiqueta saiu (reimpressões mantêm o mesmo código).
  useEffect(() => {
    if (!labels.length) return undefined;
    const registerPrint = () => fetch('/api/admin/labels/printed', { method: 'POST', headers, body: JSON.stringify({ label_ids: labels.map(({ label }) => label.id) }) }).catch(() => null);
    window.addEventListener('afterprint', registerPrint);
    return () => window.removeEventListener('afterprint', registerPrint);
  }, [labels, token]);

  async function saveLabel(orderId) {
    const draft = drafts[orderId];
    try {
      const data = await parseResponse(await fetch(`/api/admin/orders/${orderId}/label`, { method: 'PUT', headers, body: JSON.stringify({ volumes: Number(draft.volumes), weight_kg: draft.weight_kg === '' ? null : Number(draft.weight_kg) }) }));
      setLabels((current) => current.map((item) => (item.order.id === orderId ? data.label : item)));
      setError('');
    } catch (requestError) { setError(requestError.message); }
  }

  const shippingLabels = (payload) => Array.from({ length: payload.label.volumes }, (_, index) => <ShippingLabel key={`${payload.label.code}-envio-${index}`} payload={payload} volume={index + 1} logo={branding.logo} />);
  const slip = (payload) => <PickingSlip key={`${payload.label.code}-separacao`} payload={payload} />;
  const landscape = documentType === 'ambos';
  // Envio e separação: folha A5 em paisagem com o volume 1 ao lado da ficha; volumes extras saem dois por folha.
  const sheets = labels.flatMap((payload) => {
    if (documentType === 'envio') return shippingLabels(payload);
    if (documentType === 'separacao') return [slip(payload)];
    const [first, ...extra] = shippingLabels(payload);
    const pairs = [[first, slip(payload)]];
    for (let index = 0; index < extra.length; index += 2) pairs.push(extra.slice(index, index + 2));
    return pairs.map((pair, index) => <div key={`${payload.label.code}-folha-${index}`} className="label-sheet-landscape">{pair}</div>);
  });

  return (
    <div className="labels-page">
      <div className="labels-toolbar">
        <div className="labels-toolbar-heading"><Link to="/admin">← Voltar aos pedidos</Link><h1>Etiquetas</h1><p>{landscape ? 'Folha A5 em paisagem (21 × 14,8 cm): etiqueta de envio e ficha de separação lado a lado. Na janela de impressão, escolha papel A5, orientação paisagem e margens "Nenhuma".' : 'Folha de 10 × 15 cm. Na janela de impressão, escolha esse tamanho de papel e margens "Nenhuma".'}</p></div>
        {error && <Alert variant="error" title="Atenção">{error}</Alert>}
        {skipped.length > 0 && <Alert variant="warning" title="Alguns pedidos ficaram de fora">{skipped.map((item) => `Pedido ${item.order_id}: ${item.reason}`).join(' ')}</Alert>}
        {labels.length > 0 && <>
          <fieldset className="labels-documents"><legend>Imprimir</legend>{DOCUMENTS.map(([value, text]) => <label key={value}><input type="radio" name="documentType" value={value} checked={documentType === value} onChange={() => setDocumentType(value)} />{text}</label>)}</fieldset>
          <div className="labels-orders">{labels.map(({ order, label }) => <div key={order.id} className="labels-order-row">
            <div><strong>{label.code}</strong><small>{order.reference} · {order.service}{label.print_count ? ` · impressa ${label.print_count}×` : ''}</small></div>
            <label>Volumes<input type="number" min="1" max="50" value={drafts[order.id]?.volumes ?? 1} onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...current[order.id], volumes: event.target.value } }))} /></label>
            <label>Peso (kg)<input type="number" min="0.001" step="0.001" placeholder={label.weight_is_estimate && label.weight_kg ? `${formatWeight(label.weight_kg)} (estimado)` : 'Opcional'} value={drafts[order.id]?.weight_kg ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...current[order.id], weight_kg: event.target.value } }))} /></label>
            <Button variant="ghost" size="sm" onClick={() => saveLabel(order.id)}>Aplicar</Button>
          </div>)}</div>
          <Button size="lg" onClick={() => window.print()}>Imprimir {sheets.length} {sheets.length === 1 ? 'folha' : 'folhas'}</Button>
        </>}
        {loading && <p className="muted-text" role="status">Gerando etiquetas…</p>}
      </div>
      <div className="labels-sheets">{sheets}</div>
    </div>
  );
}
