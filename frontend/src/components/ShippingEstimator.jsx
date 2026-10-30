import { useState } from 'react';
import Button from './ui/Button';
import { formatZipCode } from '../utils/zipCode';

// Estimativa de frete na página do produto, disponível também para visitantes.
export default function ShippingEstimator({ productId, quantity = 1, formatPrice }) {
  const [zip, setZip] = useState('');
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function estimate(event) {
    event.preventDefault();
    if (zip.replace(/\D/g, '').length !== 8) { setError('Informe um CEP com 8 dígitos.'); setQuotes(null); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/shipping/product-quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, quantity, destination_zip: zip }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível calcular o frete agora.');
      setQuotes(data.quotes || []);
    } catch (requestError) {
      setQuotes(null); setError(requestError.message);
    } finally { setLoading(false); }
  }

  return <form className="shipping-estimator" onSubmit={estimate} aria-labelledby="shipping-estimator-title">
    <strong id="shipping-estimator-title">Calcular frete</strong>
    <div className="inline-field"><label className="sr-only" htmlFor="shipping-estimator-zip">CEP</label><input id="shipping-estimator-zip" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={zip} onChange={(event) => setZip(formatZipCode(event.target.value))} /><Button type="submit" variant="ghost" loading={loading}>Calcular</Button></div>
    <a className="muted-link" href="https://buscacepinter.correios.com.br/" target="_blank" rel="noreferrer">Não sei meu CEP</a>
    {error && <p className="error-message" role="alert">{error}</p>}
    {quotes && <ul className="shipping-quote-list" aria-live="polite">{quotes.length === 0 ? <li>Nenhuma opção de entrega para este CEP.</li> : quotes.map((quote) => <li key={`${quote.service_name}-${quote.cost}`}><span>{quote.service_name}<small>até {quote.delivery_days} {quote.delivery_days === 1 ? 'dia útil' : 'dias úteis'}</small></span><strong>{Number(quote.cost) === 0 ? 'Grátis' : formatPrice(quote.cost)}</strong></li>)}</ul>}
  </form>;
}
