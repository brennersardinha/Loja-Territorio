import { useEffect } from 'react';
import { ANALYTICS_CONSENT_KEY } from '../utils/analytics';

export function removeTenantTrackers() {
  document.querySelectorAll('[data-tenant-tracker]').forEach((element) => element.remove());
}
export function injectTenantTrackers(marketing = {}) {
  if (marketing.gtm_id && !document.querySelector('[data-tenant-tracker="gtm"]')) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script'); script.async = true; script.dataset.tenantTracker = 'gtm';
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(marketing.gtm_id)}`; document.head.appendChild(script);
  }
  if (marketing.meta_pixel_id && !document.querySelector('[data-tenant-tracker="meta"]')) {
    window.fbq = window.fbq || function fbq() { (window.fbq.queue = window.fbq.queue || []).push(arguments); };
    window.fbq('init', marketing.meta_pixel_id); window.fbq('track', 'PageView');
    const script = document.createElement('script'); script.async = true; script.dataset.tenantTracker = 'meta';
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
  }
}
export default function MarketingScripts() {
  useEffect(() => {
    let active = true; let config = {};
    removeTenantTrackers();
    const apply = () => { if (localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'granted') injectTenantTrackers(config); else removeTenantTrackers(); };
    fetch('/api/marketing-config').then((response) => response.json()).then(({ marketing = {} }) => { if (active) { config = marketing; apply(); } }).catch(() => {});
    const changed = () => apply();
    window.addEventListener('analytics-consent-change', changed);
    return () => { active = false; removeTenantTrackers(); window.removeEventListener('analytics-consent-change', changed); };
  }, []);
  return null;
}
