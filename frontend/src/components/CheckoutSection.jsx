import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from './ui/Button';
import Alert from './ui/Alert';
import EmptyState from './ui/EmptyState';
import Field from './ui/Field';
import Icon from './ui/Icon';
import { useBranding } from '../contexts/BrandingContext';
import { useAuth } from '../contexts/AuthContext';
import useStoreInfo from '../hooks/useStoreInfo';
import { formatZipCode, lookupZipCode } from '../utils/zipCode';
import StripePaymentForm from './StripePaymentForm';

const steps = ['Entrega', 'Pagamento', 'Revisão'];

// Identificação dentro do checkout: cria a conta ou entra sem sair da página; o carrinho é mantido.
function CheckoutIdentification() {
  const { mode, setMode, authForm, setAuthForm, submitAuth, status } = useAuth();
  const isRegister = mode !== 'login';
  const [touched, setTouched] = useState(false);
  // Estado próprio: o loading do AuthContext também é usado pelo carregamento do catálogo.
  const [submitting, setSubmitting] = useState(false);
  // Quem chega ao checkout sem sessão costuma ser cliente novo; o acesso com senha fica a um clique.
  useEffect(() => { setMode('register'); }, []);
  const change = (event) => setAuthForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => { setTouched(true); setSubmitting(true); try { await submitAuth(event); } finally { setSubmitting(false); } };

  return <section aria-labelledby="checkout-identification-title">
    <div className="stage-heading"><h2 id="checkout-identification-title">Identifique-se para continuar</h2><p className="muted-text">Usamos seu e-mail para enviar a confirmação e o acompanhamento do pedido.</p></div>
    <div className="segmented-control" role="group" aria-label="Tipo de acesso"><button type="button" className={isRegister ? 'active' : ''} aria-pressed={isRegister} onClick={() => setMode('register')}>Sou novo cliente</button><button type="button" className={!isRegister ? 'active' : ''} aria-pressed={!isRegister} onClick={() => setMode('login')}>Já tenho conta</button></div>
    <form className="form-grid" onSubmit={submit}>
      {isRegister && <Field label="Nome completo" name="nome" value={authForm.nome} onChange={change} minLength="2" autoComplete="name" required />}
      <Field label="E-mail" name="email" type="email" value={authForm.email} onChange={change} autoComplete="email" required />
      <Field label={isRegister ? 'Crie uma senha' : 'Senha'} name="senha" type="password" value={authForm.senha} onChange={change} minLength="6" autoComplete={isRegister ? 'new-password' : 'current-password'} hint={isRegister ? 'Mínimo de 6 caracteres. Com ela você acompanha seus pedidos.' : undefined} required />
      {touched && status && !submitting && <p className="error-message" role="alert">{status}</p>}
      <Button type="submit" size="lg" fullWidth loading={submitting}>{isRegister ? 'Criar conta e continuar' : 'Entrar e continuar'}</Button>
      {!isRegister && <Link className="muted-link" to="/conta" onClick={() => setMode('forgot')}>Esqueci minha senha</Link>}
    </form>
  </section>;
}

// Endereço estruturado: o CEP vem primeiro e preenche rua, bairro, cidade e estado.
function AddressForm({ addressForm, setAddressForm, onSubmit, onCancel, loading, defaultRecipient }) {
  const [lookingUp, setLookingUp] = useState(false);
  const [zipNotFound, setZipNotFound] = useState(false);
  const set = (name, value) => setAddressForm((current) => ({ ...current, [name]: value }));
  useEffect(() => { if (!addressForm.recipient_name && defaultRecipient) set('recipient_name', defaultRecipient); }, [defaultRecipient]);

  async function changeZip(event) {
    const zip = formatZipCode(event.target.value);
    set('zip_code', zip);
    setZipNotFound(false);
    if (zip.length !== 9) return;
    setLookingUp(true);
    const found = await lookupZipCode(zip);
    setLookingUp(false);
    if (!found) { setZipNotFound(true); return; }
    setAddressForm((current) => ({ ...current, street: found.street || current.street, neighborhood: found.neighborhood || current.neighborhood, city: found.city, state: found.state }));
    document.getElementById('address-number')?.focus();
  }

  return <form className="form-grid two-columns address-form" onSubmit={onSubmit}>
    <Field label="CEP" name="zip_code" value={addressForm.zip_code} onChange={changeZip} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" required hint={lookingUp ? 'Buscando endereço…' : undefined} error={zipNotFound ? 'CEP não encontrado. Preencha o endereço manualmente.' : undefined} />
    <Field label="Rua" name="street" value={addressForm.street} onChange={(event) => set('street', event.target.value)} autoComplete="address-line1" required className="full-span" />
    <Field id="address-number" label="Número" name="number" value={addressForm.number} onChange={(event) => set('number', event.target.value)} inputMode="numeric" required />
    <Field label="Complemento" name="complement" value={addressForm.complement} onChange={(event) => set('complement', event.target.value)} autoComplete="address-line2" placeholder="Opcional" />
    <Field label="Bairro" name="neighborhood" value={addressForm.neighborhood} onChange={(event) => set('neighborhood', event.target.value)} />
    <Field label="Cidade" name="city" value={addressForm.city} onChange={(event) => set('city', event.target.value)} autoComplete="address-level2" required />
    <Field label="Estado (UF)" name="state" value={addressForm.state} onChange={(event) => set('state', event.target.value.toUpperCase().slice(0, 2))} autoComplete="address-level1" maxLength="2" required />
    <Field label="Quem vai receber" name="recipient_name" value={addressForm.recipient_name} onChange={(event) => set('recipient_name', event.target.value)} autoComplete="name" required />
    <div className="button-row full-span"><Button type="submit" loading={loading}>Usar este endereço</Button>{onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}</div>
  </form>;
}

export default function CheckoutSection({ loading, token, user, cartItems, checkoutForm, setCheckoutForm, addressForm, setAddressForm, addresses, submitAddress, selectAddress, previewCheckout, finalizeCheckout, shippingQuotes, quoteShipping, quotingShipping, checkoutPreview, setCheckoutPreview, checkoutResult, checkoutError, formatPrice, formatDateTime, onCheckoutChange, cartSubtotal }) {
  const [step, setStep] = useState(1);
  const [fulfillment, setFulfillment] = useState(checkoutForm.shipping_method === 'pickup' ? 'pickup' : '');
  const [addingAddress, setAddingAddress] = useState(false);
  const { branding } = useBranding();
  const { storeInfo, loaded: storeInfoLoaded } = useStoreInfo();
  const { pickup, payment, shipping = {} } = storeInfo;
  const fixedMethods = shipping.fixed_methods || [];
  const providers = [payment.stripe_publishable_key && ['stripe', 'Cartão de crédito'], payment.sandbox && ['sandbox', 'Ambiente de teste']].filter(Boolean);
  const isPickup = checkoutForm.shipping_method === 'pickup' && !checkoutForm.shipping_quote_id;
  const delivery = fulfillment === 'delivery' || (!pickup.enabled && storeInfoLoaded);
  const stripeClientSecret = checkoutPreview?.payment?.provider === 'stripe' ? checkoutPreview.payment.client_secret : null;
  const resumed = useRef(false);
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  const subtotal = cartSubtotal();
  const freeShippingMin = Number(shipping.free_shipping_min || 0);
  const freeShipping = freeShippingMin > 0 && subtotal >= freeShippingMin;
  const selectedAddress = addresses.find((address) => String(address.id) === String(checkoutForm.address_id));
  const showAddressForm = addingAddress || addresses.length === 0;

  // Valor do frete conhecido antes da revisão; null enquanto nenhuma opção foi escolhida.
  const selectedQuote = shippingQuotes.find((quote) => String(quote.id) === String(checkoutForm.shipping_quote_id));
  const selectedFixed = fixedMethods.find((method) => method.code === checkoutForm.shipping_method);
  const estimatedShipping = isPickup ? 0 : selectedQuote ? Number(selectedQuote.cost) : selectedFixed ? Number(selectedFixed.cost) : null;
  const shippingCost = checkoutPreview ? Number(checkoutPreview.checkout.shipping_cost) : estimatedShipping === null ? null : freeShipping ? 0 : estimatedShipping;
  const shippingReady = isPickup || (selectedAddress && (selectedQuote || selectedFixed));

  // Mantem o processador selecionado entre os disponiveis na loja.
  useEffect(() => {
    if (providers.length && !providers.some(([value]) => value === checkoutForm.payment_provider)) {
      onCheckoutChange({ target: { name: 'payment_provider', value: providers[0][0] } });
    }
    if (checkoutForm.payment_provider === 'stripe' && checkoutForm.payment_method !== 'card') onCheckoutChange({ target: { name: 'payment_method', value: 'card' } });
  }, [providers.map(([value]) => value).join(), checkoutForm.payment_provider]);

  // Retorno de redirecionamento da Stripe (ex.: 3DS): conclui o pedido da sessao autorizada.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('checkout_session_id');
    if (!token || !sessionId || resumed.current) return;
    resumed.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    if (params.get('redirect_status') === 'succeeded') { setStep(3); finalizeCheckout(Number(sessionId)); }
  }, [token]);

  // Com transportadora ativa, cota automaticamente ao escolher o endereço.
  useEffect(() => {
    if (delivery && shipping.quotes_enabled && selectedAddress?.zip_code && !addingAddress) quoteShipping(selectedAddress.id);
  }, [delivery, shipping.quotes_enabled, selectedAddress?.id, addingAddress]);

  // Ao trocar de etapa, o foco vai para o título da etapa (e não volta ao topo da página).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  // Qualquer mudança na entrega invalida a revisão calculada anteriormente.
  useEffect(() => { setCheckoutPreview?.(null); }, [checkoutForm.shipping_method, checkoutForm.shipping_quote_id, checkoutForm.address_id]);

  const chooseFulfillment = (value) => {
    setFulfillment(value);
    setCheckoutForm((current) => ({ ...current, shipping_method: value === 'pickup' ? 'pickup' : '', shipping_quote_id: '' }));
  };
  const chooseShipping = (patch) => setCheckoutForm((current) => ({ ...current, ...patch }));
  const saveAddress = async (event) => { const created = await submitAddress(event); if (created) setAddingAddress(false); };
  const back = () => setStep((current) => Math.max(1, current - 1));
  const validateAndReview = async () => { if (await previewCheckout()) setStep(3); };
  const stepHeading = (id, label) => <div className="stage-heading"><span className="step-label">Etapa {step} de {steps.length}</span><h2 id={id} ref={headingRef} tabIndex={-1}>{label}</h2></div>;

  if (cartItems.length === 0 && !checkoutResult) return <section className="panel checkout-access"><EmptyState title={branding.texts.cart_empty} description="Adicione ao menos um produto antes de iniciar o checkout." actionLabel="Explorar produtos" onAction={() => { window.location.href = '/buscar'; }} /></section>;

  const summary = <aside className="panel order-summary checkout-order-summary"><h2>Resumo do pedido</h2><div className="checkout-products">{cartItems.map((item) => <div key={item.id}><span>{item.quantidade}× {item.nome}</span><strong>{formatPrice(Number(item.preco_unitario || item.preco) * Number(item.quantidade))}</strong></div>)}</div><div className="summary-line"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div className="summary-line"><span>{isPickup ? 'Retirada na loja' : 'Frete'}</span><span>{shippingCost === null ? 'A calcular' : shippingCost === 0 ? 'Grátis' : formatPrice(shippingCost)}</span></div>{Number(checkoutPreview?.checkout?.discount_amount) > 0 && <div className="summary-line"><span>Desconto{checkoutPreview.checkout.coupon_code ? ` (${checkoutPreview.checkout.coupon_code})` : ''}</span><span>− {formatPrice(checkoutPreview.checkout.discount_amount)}</span></div>}<div className="summary-line summary-total"><span>Total</span><strong>{formatPrice(checkoutPreview?.checkout?.total ?? subtotal + (shippingCost || 0))}</strong></div>{shippingCost === null && <small>O frete entra no total assim que você escolher a entrega.</small>}</aside>;

  if (!token) return <section className="checkout-page">
    <header className="checkout-heading"><div><span className="eyebrow">Compra segura</span><h1>Finalizar pedido</h1></div></header>
    <div className="checkout-layout checkout-flow"><div className="panel checkout-stage"><CheckoutIdentification /></div>{summary}</div>
  </section>;

  return <section className="checkout-page">
    <header className="checkout-heading"><div><span className="eyebrow">Compra segura</span><h1>Finalizar pedido</h1></div></header>
    <ol className="checkout-stepper" aria-label="Etapas do checkout">{steps.map((label, index) => { const number = index + 1; return <li key={label} className={number === step ? 'active' : number < step ? 'complete' : ''}><button type="button" onClick={() => number < step && setStep(number)} disabled={number > step} aria-current={number === step ? 'step' : undefined}><span>{number < step ? '✓' : number}</span>{label}</button></li>; })}</ol>
    {checkoutResult && <Alert variant="success" title="Pedido confirmado">{branding.texts.checkout_success} Pedido #{checkoutResult.id}. Total: {formatPrice(checkoutResult.total)}. <Link to="/conta">Acompanhar pedido</Link></Alert>}
    {checkoutError && !checkoutResult && <Alert variant="error" title="Revise as informações">{checkoutError}</Alert>}
    <div className="checkout-layout checkout-flow">
      <div className="panel checkout-stage">
        {step === 1 && <section aria-labelledby="checkout-shipping-title">
          {stepHeading('checkout-shipping-title', 'Como você quer receber?')}
          {pickup.enabled && <fieldset className="fulfillment-options"><legend className="sr-only">Forma de entrega</legend>
            <label className="choice-card fulfillment-card"><input type="radio" name="fulfillment" value="delivery" checked={fulfillment === 'delivery'} onChange={() => chooseFulfillment('delivery')} /><Icon name="truck" size={28} /><span><strong>Receber em casa</strong><small>{freeShipping ? 'Frete grátis para este pedido' : 'Frete calculado pelo CEP'}</small></span></label>
            <label className="choice-card fulfillment-card"><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} onChange={() => chooseFulfillment('pickup')} /><Icon name="store" size={28} /><span><strong>Retirar na loja — grátis</strong><small>{pickup.address}</small></span></label>
          </fieldset>}
          {isPickup && <Alert variant="info" title="Retirada na loja"><strong>{pickup.address}</strong><br />Horário: {pickup.hours}{pickup.instructions && <><br />{pickup.instructions}</>}</Alert>}
          {delivery && <div className="delivery-details">
            <h3>Endereço de entrega</h3>
            {addresses.length > 0 && !addingAddress && <fieldset className="shipping-options"><legend className="sr-only">Endereços salvos</legend>{addresses.map((address) => <label key={address.id} className="choice-card"><input type="radio" name="address_id" value={address.id} checked={String(checkoutForm.address_id) === String(address.id)} onChange={() => selectAddress(address.id)} /><span><strong>{address.street}{address.number ? `, ${address.number}` : ''}</strong><small>{[address.neighborhood, `${address.city}/${address.state}`, address.zip_code].filter(Boolean).join(' · ')}</small></span></label>)}<Button variant="ghost" size="sm" onClick={() => setAddingAddress(true)}>+ Usar outro endereço</Button></fieldset>}
            {showAddressForm && <AddressForm addressForm={addressForm} setAddressForm={setAddressForm} onSubmit={saveAddress} onCancel={addresses.length > 0 ? () => setAddingAddress(false) : null} loading={loading} defaultRecipient={user?.nome} />}
            {selectedAddress && !showAddressForm && <div className="shipping-choice">
              <h3>Opções de entrega</h3>
              {shipping.quotes_enabled && quotingShipping && <p className="muted-text" role="status">Calculando o frete para {selectedAddress.zip_code}…</p>}
              {shipping.quotes_enabled && !quotingShipping && shippingQuotes.length === 0 && <Button variant="ghost" onClick={() => quoteShipping(selectedAddress.id)}>Calcular frete novamente</Button>}
              <fieldset className="shipping-options"><legend className="sr-only">Opções de entrega</legend>
                {shipping.quotes_enabled
                  ? shippingQuotes.map((quote) => <label key={quote.id} className="choice-card"><input type="radio" name="shipping_quote_id" value={quote.id} checked={String(checkoutForm.shipping_quote_id) === String(quote.id)} onChange={() => chooseShipping({ shipping_quote_id: quote.id, shipping_method: '' })} /><span><strong>{quote.service_name}</strong><small>até {quote.delivery_days} dias úteis</small></span><b>{freeShipping ? 'Grátis' : formatPrice(quote.cost)}</b></label>)
                  : fixedMethods.map((method) => <label key={method.code} className="choice-card"><input type="radio" name="shipping_method" value={method.code} checked={checkoutForm.shipping_method === method.code} onChange={() => chooseShipping({ shipping_method: method.code, shipping_quote_id: '' })} /><span><strong>{method.label}</strong><small>até {method.eta_days} dias úteis</small></span><b>{freeShipping ? 'Grátis' : formatPrice(method.cost)}</b></label>)}
              </fieldset>
            </div>}
          </div>}
        </section>}
        {step === 2 && <section aria-labelledby="checkout-payment-title">
          {stepHeading('checkout-payment-title', 'Como deseja pagar?')}
          {providers.length === 0 ? <Alert variant="warning" title="Pagamento indisponível">A loja ainda não ativou um meio de pagamento. Tente novamente mais tarde.</Alert> : <fieldset className="shipping-options"><legend className="sr-only">Meio de pagamento</legend>{providers.map(([value, label]) => <label key={value} className="choice-card"><input type="radio" name="payment_provider" value={value} checked={checkoutForm.payment_provider === value} onChange={onCheckoutChange} /><span><strong>{label}</strong>{value === 'stripe' && <small>Visa, Mastercard, Elo e outras bandeiras</small>}</span></label>)}</fieldset>}
          {checkoutForm.payment_provider === 'sandbox' && <label>Forma de pagamento (teste)<select name="payment_method" value={checkoutForm.payment_method} onChange={onCheckoutChange}><option value="pix">Pix</option><option value="card">Cartão</option><option value="boleto">Boleto</option></select></label>}
          <label>Cupom de desconto<input name="coupon_code" value={checkoutForm.coupon_code} onChange={onCheckoutChange} placeholder="Opcional" autoCapitalize="characters" /></label>
          <Alert variant="info" title="Pagamento protegido">{checkoutForm.payment_provider === 'stripe' ? 'Os dados do cartão são digitados na próxima etapa, em formulário seguro da Stripe. A cobrança só é efetivada quando o pedido for confirmado.' : 'A confirmação do pedido acontece somente após a revisão final.'}</Alert>
        </section>}
        {step === 3 && <section aria-labelledby="checkout-review-title">
          {stepHeading('checkout-review-title', 'Revise e confirme')}
          {checkoutPreview ? <div className="checkout-review"><p><span>{checkoutPreview.checkout.address_snapshot?.type === 'pickup' ? 'Retirada' : 'Entregar em'}</span><strong>{[checkoutPreview.checkout.address_snapshot?.street, checkoutPreview.checkout.address_snapshot?.number].filter(Boolean).join(', ') || checkoutPreview.checkout.address_snapshot?.label || 'Endereço informado'}</strong></p><p><span>Entrega</span><strong>{checkoutPreview.checkout.address_snapshot?.type === 'pickup' ? 'Retirar na loja' : selectedQuote?.service_name || selectedFixed?.label || checkoutPreview.checkout.shipping_method}</strong></p><p><span>Pagamento</span><strong>{providers.find(([value]) => value === checkoutPreview.checkout.payment_provider)?.[1] || checkoutPreview.checkout.payment_method}</strong></p><small>Valores reservados até {formatDateTime(checkoutPreview.checkout.expires_at)}</small></div> : <Alert variant="warning" title="Revise os dados">Use “Recalcular pedido” para validar preço, cupom, frete e pagamento antes de finalizar.</Alert>}
          {!checkoutPreview && <Button variant="ghost" onClick={previewCheckout} loading={loading}>Recalcular pedido</Button>}
          {stripeClientSecret && !checkoutResult ? <StripePaymentForm publishableKey={payment.stripe_publishable_key} clientSecret={stripeClientSecret} checkoutSessionId={checkoutPreview.checkout.id} onAuthorized={() => finalizeCheckout()} disabled={loading} /> : <Button fullWidth size="lg" onClick={() => finalizeCheckout()} loading={loading} disabled={!checkoutPreview || Boolean(checkoutResult)}>Confirmar e finalizar pedido</Button>}
        </section>}
        <div className="checkout-navigation">{step > 1 && !checkoutResult && <Button variant="ghost" onClick={back}>← Voltar</Button>}<span />{step === 1 && <Button onClick={() => setStep(2)} disabled={!shippingReady}>Continuar para pagamento →</Button>}{step === 2 && <Button onClick={validateAndReview} loading={loading} disabled={providers.length === 0}>Revisar pedido →</Button>}</div>
      </div>
      {summary}
    </div>
  </section>;
}
