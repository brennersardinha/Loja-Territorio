import { useEffect, useState } from 'react';
import Button from './ui/Button';

const EMPTY_MARKETING = { gtm_id: '', meta_pixel_id: '', robots_disallow: [] };

export default function MarketingSection({ token, showToast }) {
  const [marketing, setMarketing] = useState(EMPTY_MARKETING);
  const [busy, setBusy] = useState(true);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/admin/marketing', { headers }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMarketing({ ...EMPTY_MARKETING, ...result.marketing });
    }).catch((error) => showToast(error.message, 'error')).finally(() => setBusy(false));
  }, [token]);

  const set = (key, value) => setMarketing((current) => ({ ...current, [key]: value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/marketing', { method: 'PUT', headers, body: JSON.stringify(marketing) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Operação não concluída.');
      setMarketing({ ...EMPTY_MARKETING, ...result.marketing });
      showToast('Rastreamento salvo.', 'success');
    } catch (error) { showToast(error.message, 'error'); } finally { setBusy(false); }
  }

  return <section className="branding-page"><div className="panel-header"><div><span className="eyebrow">Marketing</span><h2>Rastreamento seguro</h2><p className="muted-text">Os scripts só são carregados depois do consentimento do visitante.</p></div></div>
    <form className="panel form-grid" onSubmit={save}>
      <label>Google Tag Manager<input value={marketing.gtm_id || ''} placeholder="GTM-XXXXXXX" onChange={(event) => set('gtm_id', event.target.value)} /></label>
      <label>Meta Pixel ID<input value={marketing.meta_pixel_id || ''} onChange={(event) => set('meta_pixel_id', event.target.value)} /></label>
      <label>Bloqueios no robots.txt<textarea value={(marketing.robots_disallow || []).join('\n')} placeholder="/conta" onChange={(event) => set('robots_disallow', event.target.value.split(/\n/).filter(Boolean))} /></label>
      <Button type="submit" loading={busy} loadingLabel="Salvando…">Salvar rastreamento</Button>
    </form>
  </section>;
}
