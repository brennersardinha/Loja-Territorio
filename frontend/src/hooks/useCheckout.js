import { useState } from 'react';
import { validateAddressForm, validateCheckoutForm } from '../utils/formValidation';
import { analyticsItem, trackEvent } from '../utils/analytics';

const initialCheckoutForm = {
  address_id: '',
  shipping_address_text: '',
  shipping_method: 'standard',
  shipping_quote_id: '',
  payment_provider: import.meta.env.DEV ? 'sandbox' : 'stripe',
  payment_method: import.meta.env.DEV ? 'pix' : 'card',
  coupon_code: '',
};

const initialAddressForm = {
  label: '',
  recipient_name: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  is_default: true,
};

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.');
    return data;
  });
}

export default function useCheckout({ token, setStatus, setLoading, cartItems = [] } = {}) {
  const [checkoutForm, setCheckoutForm] = useState(initialCheckoutForm);
  const [addressForm, setAddressForm] = useState(initialAddressForm);
  const [addresses, setAddresses] = useState([]);
  const [checkoutPreview, setCheckoutPreview] = useState(null);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [shippingQuotes, setShippingQuotes] = useState([]);

  const authHeaders = (currentToken = token) => ({ Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' });

  async function fetchAddresses(currentToken = token) {
    if (!currentToken) return;
    try {
      const response = await fetch('/api/addresses', { headers: authHeaders(currentToken) });
      const data = await parseResponse(response);
      setAddresses(data.items || []);
      if (!checkoutForm.address_id && data.items?.length > 0) {
        setCheckoutForm((current) => ({ ...current, address_id: String(data.items[0].id) }));
      }
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function submitAddress(event) {
    if (event && event.preventDefault) event.preventDefault();
    const validationError = validateAddressForm(addressForm);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }
    try {
      const response = await fetch('/api/addresses', { method: 'POST', headers: authHeaders(), body: JSON.stringify(addressForm) });
      await parseResponse(response);
      await fetchAddresses(token);
      setStatus?.('Endereco cadastrado.');
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function removeAddress(id) {
    try {
      const response = await fetch(`/api/addresses/${id}`, { method: 'DELETE', headers: authHeaders() });
      await parseResponse(response);
      await fetchAddresses(token);
      setStatus?.('Endereco removido.');
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function previewCheckout() {
    const validationError = validateCheckoutForm(checkoutForm);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }
    try {
      const response = await fetch('/api/checkout/start', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...checkoutForm }) });
      const data = await parseResponse(response);
      setCheckoutPreview(data || null);
      const checkout = data.checkout || {};
      trackEvent('begin_checkout', {
        currency: 'BRL',
        value: Number(checkout.total || 0),
        coupon: checkout.coupon_code || undefined,
        items: cartItems.map((item) => analyticsItem(item, item.quantidade)),
      });
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function quoteShipping() {
    const address=addresses.find((item)=>String(item.id)===String(checkoutForm.address_id));
    if(!address?.zip_code){setStatus?.('Selecione um endereco salvo com CEP para cotar o frete.');return;}
    setLoading?.(true);
    try{const response=await fetch('/api/shipping/quotes',{method:'POST',headers:authHeaders(),body:JSON.stringify({destination_zip:address.zip_code})});const data=await parseResponse(response);setShippingQuotes(data.quotes||[]);setStatus?.(`${data.quotes?.length||0} opcao(oes) de frete encontrada(s).`);}catch(error){setStatus?.(error.message);}finally{setLoading?.(false);}
  }

  // sessionId e informado ao voltar de um redirecionamento da Stripe (ex.: autenticacao 3DS).
  async function finalizeCheckout(sessionId = null) {
    const validationError = sessionId ? null : validateCheckoutForm(checkoutForm);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }
    setLoading?.(true);
    try {
      const checkoutSessionId = sessionId || checkoutPreview?.checkout?.id;
      if (!checkoutSessionId) {
        setStatus?.('Valide o checkout antes de finalizar o pedido.');
        return;
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ checkout_session_id: checkoutSessionId }),
      });
      const data = await parseResponse(response);
      const order = data.order;
      setCheckoutResult(order);
      setStatus?.('Pedido realizado.');
      trackEvent('purchase', {
        transaction_id: String(order.id),
        currency: 'BRL',
        value: Number(order.total || 0),
        shipping: Number(order.shipping_cost || 0),
        coupon: order.coupon_code || undefined,
        items: cartItems.map((item) => analyticsItem(item, item.quantidade)),
      });
      await fetchAddresses(token);
    } catch (error) {
      setStatus?.(error.message);
    } finally {
      setLoading?.(false);
    }
  }

  return {
    checkoutForm,
    setCheckoutForm,
    addressForm,
    setAddressForm,
    addresses,
    setAddresses,
    checkoutPreview,
    setCheckoutPreview,
    checkoutResult,
    setCheckoutResult,
    fetchAddresses,
    submitAddress,
    removeAddress,
    previewCheckout,
    finalizeCheckout,
    shippingQuotes,
    quoteShipping,
  };
}

