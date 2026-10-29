import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { accessibleForeground, validateThemeContrast } from '../utils/colorContrast';
import { uiCopy } from '../config/uiCopy';

export const DEFAULT_BRANDING = {
  store_name: 'Minha Loja', logo: '', favicon: '', banners: [],
  colors: { primary: '#3b82f6', secondary: '#1f2937', background: '#f8f9fa' },
  font: 'Inter', border_radius: 8,
  texts: { welcome: uiCopy.whiteLabel.welcome, cart_empty: uiCopy.whiteLabel.cartEmpty, checkout_success: uiCopy.whiteLabel.checkoutSuccess },
};

const BrandingContext = createContext({ branding: DEFAULT_BRANDING, loading: true, storeState: 'loading' });

function applyBranding(branding) {
  const root = document.documentElement;
  const contrast = validateThemeContrast(branding.colors);
  if (!contrast.valid) return false;
  const primary = branding.colors.primary;
  root.style.setProperty('--color-primary', branding.colors.primary);
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-foreground', accessibleForeground(primary));
  root.style.setProperty('--primary-hover', `color-mix(in srgb, ${primary}, black 12%)`);
  root.style.setProperty('--primary-active', `color-mix(in srgb, ${primary}, black 22%)`);
  root.style.setProperty('--primary-border', `color-mix(in srgb, ${primary}, white 68%)`);
  root.style.setProperty('--color-primary-border', `color-mix(in srgb, ${primary}, white 68%)`);
  root.style.setProperty('--accent', `color-mix(in srgb, ${primary}, white 92%)`);
  root.style.setProperty('--color-primary-soft', `color-mix(in srgb, ${primary}, white 92%)`);
  root.style.setProperty('--ring', `color-mix(in srgb, ${primary} 32%, transparent)`);
  root.style.setProperty('--color-text-strong', branding.colors.secondary);
  root.style.setProperty('--secondary', branding.colors.secondary);
  root.style.setProperty('--foreground', branding.colors.secondary);
  root.style.setProperty('--color-canvas', branding.colors.background);
  root.style.setProperty('--background', branding.colors.background);
  root.style.setProperty('--canvas-glaze-end', `color-mix(in srgb, ${branding.colors.background} 96%, white)`);
  root.style.setProperty('--radius-control', `${branding.border_radius}px`);
  root.style.setProperty('--radius-inner', `${Math.max(2, branding.border_radius - 2)}px`);
  root.style.setProperty('--radius-media', `${branding.border_radius + 2}px`);
  root.style.setProperty('--radius-card', `${branding.border_radius + 4}px`);
  root.style.setProperty('--font-sans', `"${branding.font}", ui-sans-serif, system-ui, sans-serif`);
  document.title = branding.store_name;
  let favicon = document.querySelector("link[rel='icon']");
  if (branding.favicon) {
    if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
    favicon.href = branding.favicon;
  }
  const fontId = 'tenant-google-font';
  document.getElementById(fontId)?.remove();
  if (branding.font !== 'Inter') {
    const link = document.createElement('link'); link.id = fontId; link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(branding.font).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
  return true;
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [storeState, setStoreState] = useState('loading');
  useEffect(() => {
    let active = true;
    fetch('/api/branding').then(async (response) => {
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'Falha ao carregar identidade visual.'); error.status = response.status; throw error; }
      if (active) { const next = { ...DEFAULT_BRANDING, ...data.branding, colors: { ...DEFAULT_BRANDING.colors, ...data.branding?.colors }, texts: { ...DEFAULT_BRANDING.texts, ...data.branding?.texts } }; setBranding(next); setStoreState('ready'); applyBranding(next); }
    }).catch((error) => { if (active) setStoreState('unavailable'); applyBranding(DEFAULT_BRANDING); }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  const value = useMemo(() => ({ branding, setBranding, loading, storeState, applyBranding }), [branding, loading, storeState]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
