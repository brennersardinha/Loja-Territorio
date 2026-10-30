import { useEffect, useState } from 'react';
import { DEFAULT_BRANDING, useBranding } from '../contexts/BrandingContext';
import { fileToImageDataUrl } from '../hooks/useImageHelpers';
import { accessibleForeground, validateThemeContrast } from '../utils/colorContrast';
import Button from './ui/Button';
import Field from './ui/Field';
import Badge from './ui/Badge';
import Modal from './ui/Modal';

const FONTS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Source Sans 3'];
const mergeBranding = (value = {}) => ({ ...DEFAULT_BRANDING, ...value, colors: { ...DEFAULT_BRANDING.colors, ...value.colors }, texts: { ...DEFAULT_BRANDING.texts, ...value.texts }, banners: Array.isArray(value.banners) ? value.banners : [], home_sections: Array.isArray(value.home_sections) ? value.home_sections : [] });
const MAX_HOME_SECTIONS = 4;
const SECTION_SUGGESTIONS = ['Novidades', 'Mais vendidos', 'Ofertas', 'Coleção'];

function imageDimensions(dataUrl) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = () => reject(new Error('Não foi possível ler a imagem.')); image.src = dataUrl; });
}

export default function BrandingSection({ token, showToast }) {
  const { setBranding, applyBranding } = useBranding();
  const [form, setForm] = useState(DEFAULT_BRANDING);
  const [busy, setBusy] = useState(true);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const contrast = validateThemeContrast(form.colors);
  const previewStyle = { '--preview-primary': form.colors.primary, '--preview-secondary': form.colors.secondary, '--preview-background': form.colors.background, '--preview-primary-text': accessibleForeground(form.colors.primary), '--preview-radius': `${form.border_radius}px`, '--preview-font': `"${form.font}", sans-serif` };

  useEffect(() => { fetch('/api/admin/branding', { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setForm(mergeBranding(data.branding)); }).catch((error) => showToast(error.message, 'error')).finally(() => setBusy(false)); }, [token, showToast]);
  useEffect(() => { fetch('/api/categories').then((response) => (response.ok ? response.json() : [])).then((data) => setCategories(Array.isArray(data) ? data : [])).catch(() => setCategories([])); }, []);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const setSection = (index, key, value) => set('home_sections', form.home_sections.map((section, itemIndex) => (itemIndex === index ? { ...section, [key]: value } : section)));
  const addSection = () => set('home_sections', [...form.home_sections, { title: SECTION_SUGGESTIONS[form.home_sections.length] || 'Destaques', category_id: categories[0]?.id || '' }]);
  const setNested = (group, key, value) => setForm((old) => ({ ...old, [group]: { ...old[group], [key]: value } }));

  async function imageChange(event, key, multiple = false) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (multiple && files.length > 5) return showToast('Selecione no máximo 5 banners.', 'error');
    if (files.some((file) => !file.type.startsWith('image/') || file.size > 2_000_000)) return showToast('Use imagens de até 2 MB nos formatos PNG, JPG, WEBP, GIF ou SVG.', 'error');
    try {
      const images = await Promise.all(files.map(fileToImageDataUrl));
      const dimensions = await Promise.all(images.map(imageDimensions));
      if (key === 'favicon' && dimensions.some(({ width, height }) => width !== height)) return showToast('O favicon precisa ser quadrado.', 'error');
      if (key === 'logo' && dimensions.some(({ width, height }) => width < 120 || height < 40)) return showToast('O logotipo deve ter no mínimo 120 × 40 px.', 'error');
      set(key, multiple ? images : images[0] || '');
    } catch (error) { showToast(error.message, 'error'); }
  }

  async function submit(event) {
    event.preventDefault();
    if (!contrast.valid) return showToast(contrast.errors.join(' '), 'error');
    setBusy(true);
    try {
      const response = await fetch('/api/admin/branding', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branding: form }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.errors?.join(' ') || data.error);
      const saved = mergeBranding(data.branding); setForm(saved); setBranding(saved); applyBranding(saved); showToast('Identidade visual publicada.', 'success');
    } catch (error) { showToast(error.message || 'Não foi possível salvar.', 'error'); } finally { setBusy(false); }
  }

  const restoreDefaults = () => { setForm(mergeBranding(DEFAULT_BRANDING)); setRestoreOpen(false); showToast('Tema padrão carregado no editor. Publique para aplicar.', 'info'); };

  return <section className="branding-page"><div className="panel-header"><div><span className="eyebrow">Aparência da loja</span><h2>Identidade visual</h2><p className="muted-text">Personalize a loja e confira o resultado antes de publicar.</p></div><div className="button-row"><Badge variant={contrast.valid ? 'success' : 'danger'}>{contrast.valid ? 'Contraste válido' : 'Requer ajustes'}</Badge><Button variant="ghost" size="sm" onClick={() => setRestoreOpen(true)}>Restaurar padrão</Button></div></div>
    <div className="branding-layout">
      <form className="panel branding-editor" onSubmit={submit}>
        <section><h3>Marca</h3><Field label="Nome da loja" value={form.store_name} maxLength="100" required onChange={(event) => set('store_name', event.target.value)} /><Field label="Fonte" as="select" value={form.font} onChange={(event) => set('font', event.target.value)}>{FONTS.map((font) => <option key={font}>{font}</option>)}</Field></section>
        <section><h3>Paleta</h3><div className="branding-colors">{Object.entries({ primary: 'Ação principal', secondary: 'Texto principal', background: 'Fundo da loja' }).map(([key, label]) => <label key={key}>{label}<span><input type="color" value={form.colors[key]} onChange={(event) => setNested('colors', key, event.target.value)} /><input className="technical-data" value={form.colors[key]} pattern="#[0-9a-fA-F]{6}" onChange={(event) => setNested('colors', key, event.target.value)} aria-label={`${label} hexadecimal`} /></span></label>)}</div><div className={`contrast-summary ${contrast.valid ? 'contrast-valid' : 'contrast-invalid'}`} role="status" aria-live="polite"><strong>{contrast.valid ? '✓ Contraste aprovado' : '⚠ Ajuste as cores'}</strong><span>Texto/fundo: {contrast.textRatio.toFixed(2)}:1 · Ação/fundo: {contrast.actionRatio.toFixed(2)}:1</span>{contrast.errors.map((error) => <span key={error}>{error}</span>)}</div><Field label="Raio das bordas (px)" hint="Entre 0 e 32." type="range" min="0" max="32" value={form.border_radius} onChange={(event) => set('border_radius', Number(event.target.value))} /><output>{form.border_radius} px</output></section>
        <section><h3>Arquivos de marca</h3><label>Logotipo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(event) => imageChange(event, 'logo')} /><small>Mínimo 120 × 40 px, até 2 MB.</small>{form.logo && <div className="branding-media-item"><img src={form.logo} alt="Prévia do logotipo" /><Button variant="danger" size="sm" onClick={() => set('logo', '')}>Remover</Button></div>}</label><label>Favicon<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(event) => imageChange(event, 'favicon')} /><small>Imagem quadrada, até 2 MB.</small>{form.favicon && <div className="branding-media-item"><img className="favicon-preview" src={form.favicon} alt="Prévia do favicon" /><Button variant="danger" size="sm" onClick={() => set('favicon', '')}>Remover</Button></div>}</label><label>Banners<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple onChange={(event) => imageChange(event, 'banners', true)} /><small>Até 5 imagens de 2 MB cada. O primeiro banner é a imagem principal da página inicial; os demais aparecem no fim da página.</small></label>{form.banners.length > 0 && <div className="branding-banner-list">{form.banners.map((banner, index) => <div key={`${banner.slice(-20)}-${index}`}><img src={banner} alt={`Banner ${index + 1}`} /><Button variant="danger" size="sm" onClick={() => set('banners', form.banners.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button></div>)}</div>}</section>
        <section><h3>Banner da página inicial</h3><Field label="Título" maxLength="300" value={form.texts.welcome} onChange={(event) => setNested('texts', 'welcome', event.target.value)} /><Field label="Subtítulo" maxLength="300" value={form.texts.hero_subtitle} onChange={(event) => setNested('texts', 'hero_subtitle', event.target.value)} hint="Opcional. Ex.: novidades toda semana e retirada grátis na loja." /><Field label="Texto do botão" maxLength="40" value={form.texts.hero_cta} onChange={(event) => setNested('texts', 'hero_cta', event.target.value)} /></section>
        <section><h3>Seções da página inicial</h3><p className="muted-text">Vitrines exibidas abaixo das categorias, com os produtos da categoria escolhida. Sem seções, a página mostra as novidades do catálogo.</p>{form.home_sections.map((section, index) => <div className="home-section-row" key={index}><Field label={`Título da seção ${index + 1}`} maxLength="60" value={section.title} required onChange={(event) => setSection(index, 'title', event.target.value)} /><Field label="Categoria" as="select" value={section.category_id} required onChange={(event) => setSection(index, 'category_id', Number(event.target.value))}><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</Field><Button variant="ghost" size="sm" onClick={() => set('home_sections', form.home_sections.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover seção ${index + 1}`}>Remover</Button></div>)}{form.home_sections.length < MAX_HOME_SECTIONS && <Button variant="ghost" size="sm" onClick={addSection} disabled={!categories.length}>+ Adicionar seção</Button>}{!categories.length && <small className="muted-text">Cadastre categorias para criar seções.</small>}</section>
        <section><h3>Mensagens</h3><Field label="Carrinho vazio" maxLength="300" value={form.texts.cart_empty} onChange={(event) => setNested('texts', 'cart_empty', event.target.value)} /><Field label="Pedido concluído" maxLength="300" value={form.texts.checkout_success} onChange={(event) => setNested('texts', 'checkout_success', event.target.value)} /></section>
        <Button type="submit" fullWidth loading={busy} loadingLabel="Publicando…" disabled={!contrast.valid}>Publicar alterações</Button>
      </form>
      <aside className="branding-preview-panel"><div className="preview-heading"><div><span className="eyebrow">Preview em tempo real</span><h3>Loja desktop</h3></div><Badge variant="info">Não publicado</Badge></div><div className="store-theme-preview" style={previewStyle}><header>{form.logo ? <img src={form.logo} alt="" /> : <strong>{form.store_name || 'Sua loja'}</strong>}<nav>Início　 Produtos　 Conta　 Carrinho</nav></header>{form.banners[0] ? <img className="preview-banner" src={form.banners[0]} alt="" /> : <div className="preview-hero"><h4>{form.texts.welcome || 'Explore nossos produtos'}</h4>{form.texts.hero_subtitle && <span>{form.texts.hero_subtitle}</span>}<button type="button">{form.texts.hero_cta || 'Ver produtos'}</button></div>}<main><div className="preview-card"><div /><small>Categoria</small><strong>Produto em destaque</strong><span>R$ 199,90</span><button type="button">Adicionar</button></div><div className="preview-card"><div /><small>Categoria</small><strong>Nova coleção</strong><span>R$ 249,90</span><button type="button">Adicionar</button></div></main><footer>{form.store_name || 'Sua loja'} · Compra segura</footer></div></aside>
    </div><Modal open={restoreOpen} title="Restaurar tema padrão?" description="As alterações no editor serão substituídas pelos valores originais. Nada será publicado até você confirmar no botão Publicar alterações." confirmLabel="Carregar tema padrão" onClose={() => setRestoreOpen(false)} onConfirm={restoreDefaults} />
  </section>;
}
