import { useState } from 'react';
import { validateAddressForm, validateCheckoutForm } from '../utils/formValidation';
import { analyticsItem, trackEvent } from '../utils/analytics';

const initialCheckoutForm = {
  address_id: '',
  shipping_address_text: '',
  shipping_method: '',
  shipping_quote_id: '',
  payment_provider: import.meta.env.DEV ? 'sandbox' : 'stripe',
  payment_method: import.meta.env.DEV ? 'pix' : 'card',
  coupon_code: '',
};

const initialAddressForm = {
  label: 'Casa',
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
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
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
  const [quotingShipping, setQuotingShipping] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Erros aparecem no próprio checkout (o status geral só é exibido na página da conta).
  const reportError = (message) => { setStatus?.(message); setCheckoutError(message); };

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

  // Salva o endereço e já o seleciona para a entrega; retorna o endereço criado.
  async function submitAddress(event, values = addressForm) {
    if (event && event.preventDefault) event.preventDefault();
    const validationError = validateAddressForm(values);
    if (validationError) {
      reportError(validationError);
      return null;
    }
    try {
      const response = await fetch('/api/addresses', { method: 'POST', headers: authHeaders(), body: JSON.stringify(values) });
      const data = await parseResponse(response);
      await fetchAddresses(token);
      if (data.address) selectAddress(data.address.id);
      setAddressForm(initialAddressForm);
      setCheckoutError('');
      setStatus?.('Endereço cadastrado.');
      return data.address || null;
    } catch (error) {
      reportError(error.message);
      return null;
    }
  }

  // Trocar o endereço invalida a opção de frete escolhida (o preço depende do CEP).
  function selectAddress(id) {
    setShippingQuotes([]);
    setCheckoutForm((current) => ({ ...current, address_id: String(id), shipping_quote_id: '', shipping_method: current.shipping_method === 'pickup' ? 'pickup' : '' }));
  }

  async function removeAddress(id) {
    try {
      const response = await fetch(`/api/addresses/${id}`, { method: 'DELETE', headers: authHeaders() });
      await parseResponse(response);
      await fetchAddresses(token);
      setStatus?.('Endereço removido.');
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function previewCheckout() {
    const validationError = validateCheckoutForm(checkoutForm);
    if (validationError) {
      reportError(validationError);
      return false;
    }
    setLoading?.(true);
    try {
      const response = await fetch('/api/checkout/start', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...checkoutForm }) });
      const data = await parseResponse(response);
      setCheckoutPreview(data || null);
      setCheckoutError('');
      const checkout = data.checkout || {};
      trackEvent('begin_checkout', {
        currency: 'BRL',
        value: Number(checkout.total || 0),
        coupon: checkout.coupon_code || undefined,
        items: cartItems.map((item) => analyticsItem(item, item.quantidade)),
      });
      return true;
    } catch (error) {
      reportError(error.message);
      return false;
    } finally {
      setLoading?.(false);
    }
  }

  async function quoteShipping(addressId = checkoutForm.address_id) {
    const address=addresses.find((item)=>String(item.id)===String(addressId));
    if(!address?.zip_code){reportError('Selecione um endereço com CEP para calcular o frete.');return;}
    setQuotingShipping(true);setShippingQuotes([]);
    try{const response=await fetch('/api/shipping/quotes',{method:'POST',headers:authHeaders(),body:JSON.stringify({destination_zip:address.zip_code})});const data=await parseResponse(response);setShippingQuotes(data.quotes||[]);setCheckoutError('');setStatus?.(`${data.quotes?.length||0} opção(ões) de frete encontrada(s).`);}catch(error){reportError(error.message);}finally{setQuotingShipping(false);}
  }

  // sessionId e informado ao voltar de um redirecionamento da Stripe (ex.: autenticacao 3DS).
  async function finalizeCheckout(sessionId = null) {
    const validationError = sessionId ? null : validateCheckoutForm(checkoutForm);
    if (validationError) {
      reportError(validationError);
      return;
    }
    setLoading?.(true);
    try {
      const checkoutSessionId = sessionId || checkoutPreview?.checkout?.id;
      if (!checkoutSessionId) {
        reportError('Valide o checkout antes de finalizar o pedido.');
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
      setCheckoutError('');
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
      reportError(error.message);
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
    selectAddress,
    removeAddress,
    previewCheckout,
    finalizeCheckout,
    shippingQuotes,
    quoteShipping,
    quotingShipping,
    checkoutError,
    setCheckoutError,
  };
}

