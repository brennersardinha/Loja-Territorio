import { useEffect, useState } from 'react';

export const EMPTY_STORE_INFO = {
  pickup: { enabled: false, address: '', hours: '', instructions: '' },
  contact: { email: '', phone: '', whatsapp: '' },
  policies: { privacy: '', exchanges: '' },
  payment: { sandbox: false, stripe_publishable_key: null },
  shipping: { free_shipping_min: 0, quotes_enabled: false, fixed_methods: [] },
  company: null,
};

let cached = null;

export function clearStoreInfoCache() { cached = null; }

function fetchStoreInfo() {
  if (!cached) {
    cached = fetch('/api/store-info')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Falha ao carregar dados da loja.'))))
      .then((data) => ({ ...EMPTY_STORE_INFO, ...data }))
      .catch((error) => { cached = null; throw error; });
  }
  return cached;
}

// Dados publicos da loja (retirada, contato, politicas e meios de pagamento ativos), buscados uma vez.
export default function useStoreInfo() {
  const [storeInfo, setStoreInfo] = useState(EMPTY_STORE_INFO);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    fetchStoreInfo().then((data) => { if (active) setStoreInfo(data); }).catch(() => {}).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  return { storeInfo, loaded };
}
