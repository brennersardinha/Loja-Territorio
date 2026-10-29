import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getAnalyticsConsent,
  initializeAnalytics,
  isAnalyticsConfigured,
  setAnalyticsConsent,
  trackPageView,
} from '../utils/analytics';

export default function AnalyticsManager() {
  const location = useLocation();
  const [tenantConfigured, setTenantConfigured] = useState(false);
  const configured = isAnalyticsConfigured() || tenantConfigured;
  const [consent, setConsent] = useState(() => getAnalyticsConsent() || 'denied');
  const [showPreferences, setShowPreferences] = useState(() => !getAnalyticsConsent());

  useEffect(() => { fetch('/api/marketing-config').then((response) => response.json()).then(({ marketing = {} }) => setTenantConfigured(Boolean(marketing.gtm_id || marketing.meta_pixel_id))).catch(() => {}); }, []);

  useEffect(() => {
    if (configured && consent === 'granted') {
      initializeAnalytics();
      trackPageView(`${location.pathname}${location.search}`);
    }
  }, [configured, consent, location.pathname, location.search]);

  if (!configured) return null;

  function choose(value) {
    setAnalyticsConsent(value);
    setConsent(value);
    setShowPreferences(false);
  }

  return (
    <>
      {showPreferences && (
        <section className="analytics-consent" role="dialog" aria-modal="false" aria-labelledby="analytics-consent-title">
          <div>
            <strong id="analytics-consent-title">Privacidade e estatísticas</strong>
            <p>Usamos dados anônimos de navegação para entender o uso da loja. A coleta só começa com sua autorização.</p>
          </div>
          <div className="button-row">
            <button className="ghost-button compact" type="button" onClick={() => choose('denied')}>Recusar</button>
            <button className="primary-button compact" type="button" onClick={() => choose('granted')}>Aceitar estatísticas</button>
          </div>
        </section>
      )}
      {!showPreferences && (
        <button className="analytics-preferences-button" type="button" onClick={() => setShowPreferences(true)}>
          Privacidade
        </button>
      )}
    </>
  );
}
