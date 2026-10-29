export const ANALYTICS_CONSENT_KEY = 'ecommerce.analytics-consent.v1';

const configuredMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
let initialized = false;

export function isAnalyticsConfigured() {
  return /^G-[A-Z0-9]+$/i.test(configuredMeasurementId);
}

export function getAnalyticsConsent() {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value) {
  if (value !== 'granted' && value !== 'denied') return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent('analytics-consent-change', { detail: value }));
  if (value === 'granted') initializeAnalytics();
  if (initialized) {
    window.gtag('consent', 'update', { analytics_storage: value });
  }
}

export function initializeAnalytics(measurementId = configuredMeasurementId) {
  if (initialized || !/^G-[A-Z0-9]+$/i.test(measurementId)) return false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false, anonymize_ip: true });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.analytics = 'ga4';
  document.head.appendChild(script);
  initialized = true;
  return true;
}

export function trackEvent(name, parameters = {}) {
  if (getAnalyticsConsent() !== 'granted') return false;
  initializeAnalytics();
  if (!initialized) return false;
  window.gtag('event', name, parameters);
  return true;
}

export function trackPageView(path, title = document.title) {
  return trackEvent('page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  });
}

export function analyticsItem(product, quantity = 1) {
  return {
    item_id: String(product?.produto_id || product?.id || ''),
    item_name: product?.nome || product?.nome_produto || 'Produto',
    item_category: product?.categoria_nome || undefined,
    price: Number(product?.preco || product?.preco_atual || product?.preco_unitario || 0),
    quantity: Number(quantity || product?.quantidade || 1),
  };
}

export function resetAnalyticsForTests() {
  initialized = false;
}
