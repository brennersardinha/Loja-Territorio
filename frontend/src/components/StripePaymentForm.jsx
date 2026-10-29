import { useEffect, useRef, useState } from 'react';
import Alert from './ui/Alert';
import Button from './ui/Button';
import { loadStripe } from '../utils/stripe';

// Formulario de cartao da Stripe (Payment Element). Os dados do cartao nunca passam pelo nosso servidor:
// a Stripe autoriza o valor e o backend so captura depois de gravar o pedido.
export default function StripePaymentForm({ publishableKey, clientSecret, checkoutSessionId, onAuthorized, disabled }) {
  const containerRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let element;
    setReady(false); setError('');
    loadStripe(publishableKey).then((stripe) => {
      if (!active || !containerRef.current) return;
      const elements = stripe.elements({ clientSecret, locale: 'pt-BR' });
      element = elements.create('payment');
      element.on?.('ready', () => active && setReady(true));
      element.mount(containerRef.current);
      stripeRef.current = stripe;
      elementsRef.current = elements;
    }).catch((loadError) => active && setError(loadError.message));
    return () => { active = false; element?.destroy?.(); };
  }, [publishableKey, clientSecret]);

  async function pay() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true); setError('');
    try {
      const returnUrl = `${window.location.origin}/checkout?checkout_session_id=${encodeURIComponent(checkoutSessionId)}`;
      const result = await stripeRef.current.confirmPayment({ elements: elementsRef.current, redirect: 'if_required', confirmParams: { return_url: returnUrl } });
      if (result.error) { setError(result.error.message || 'Pagamento recusado.'); return; }
      await onAuthorized();
    } finally { setBusy(false); }
  }

  return <div className="stripe-payment">
    <div ref={containerRef} className="stripe-payment-element" aria-label="Dados do cartão" />
    {error && <Alert variant="danger" title="Pagamento não concluído">{error}</Alert>}
    <Button fullWidth size="lg" onClick={pay} loading={busy} loadingLabel="Processando pagamento…" disabled={disabled || !ready}>Pagar e finalizar pedido</Button>
  </div>;
}
