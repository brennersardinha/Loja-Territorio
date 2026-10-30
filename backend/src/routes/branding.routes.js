const express = require('express');
const { getPermissions, PERMISSIONS } = require('../config/rbac');

const DEFAULT_BRANDING = Object.freeze({
  store_name: 'Minha Loja', logo: '', favicon: '', banners: [],
  // Capa alternativa para telas estreitas (retrato); vazia usa o primeiro banner.
  banner_mobile: '',
  colors: { primary: '#3b82f6', secondary: '#1f2937', background: '#f8f9fa' },
  font: 'Inter', heading_font: '', border_radius: 8,
  texts: { welcome: 'Encontre produtos que combinam com você', hero_subtitle: '', hero_cta: 'Ver produtos', cart_empty: 'Seu carrinho está vazio.', checkout_success: 'Pedido realizado com sucesso.' },
  // Vitrines da pagina inicial: titulo e categoria de origem dos produtos.
  home_sections: [],
});
const TEXT_KEYS = Object.keys(DEFAULT_BRANDING.texts);
const ALLOWED_FONTS = new Set(['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Source Sans 3', 'Manrope']);
// Fonte opcional dos títulos; vazio usa a fonte principal.
const ALLOWED_HEADING_FONTS = new Set(['', ...ALLOWED_FONTS, 'Fraunces', 'Playfair Display', 'Lora']);
// HTTPS, data URL ou arquivo publicado pela própria vitrine (/pasta/arquivo.ext, sem "//" nem "..").
const IMAGE_PATTERN = /^(https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?|data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+|\/(?!\/)(?!.*\.\.)[a-z0-9/_.-]+\.(?:png|jpe?g|webp|gif|svg))$/i;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function relativeLuminance(hex) {
  if (!COLOR_PATTERN.test(hex || '')) return null;
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a === null || b === null) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function validateBranding(input) {
  const errors = [];
  const value = { ...DEFAULT_BRANDING, ...input };
  value.store_name = typeof value.store_name === 'string' ? value.store_name.trim() : '';
  if (!value.store_name || value.store_name.length > 100) errors.push('Nome da loja deve ter entre 1 e 100 caracteres.');
  for (const field of ['logo', 'favicon', 'banner_mobile']) {
    if (value[field] && (typeof value[field] !== 'string' || !IMAGE_PATTERN.test(value[field]) || value[field].length > 2_500_000)) errors.push(`${field} deve ser uma imagem HTTPS ou data URL válida.`);
  }
  if (!Array.isArray(value.banners) || value.banners.length > 5 || value.banners.some((item) => typeof item !== 'string' || !IMAGE_PATTERN.test(item) || item.length > 2_500_000)) errors.push('Banners devem conter no máximo 5 imagens válidas.');
  value.colors = { ...DEFAULT_BRANDING.colors, ...(value.colors || {}) };
  for (const field of ['primary', 'secondary', 'background']) if (!COLOR_PATTERN.test(value.colors[field] || '')) errors.push(`Cor ${field} inválida.`);
  if (['primary', 'secondary', 'background'].every((field) => COLOR_PATTERN.test(value.colors[field]))) {
    if (contrastRatio(value.colors.secondary, value.colors.background) < 4.5) errors.push('Contraste entre texto e fundo deve ser de pelo menos 4,5:1.');
    if (contrastRatio(value.colors.primary, value.colors.background) < 3) errors.push('Contraste entre cor de ação e fundo deve ser de pelo menos 3:1.');
  }
  if (!ALLOWED_FONTS.has(value.font)) errors.push('Fonte não permitida.');
  if (!ALLOWED_HEADING_FONTS.has(value.heading_font)) errors.push('Fonte dos títulos não permitida.');
  value.border_radius = Number(value.border_radius);
  if (!Number.isInteger(value.border_radius) || value.border_radius < 0 || value.border_radius > 32) errors.push('Raio de borda deve ser um inteiro entre 0 e 32.');
  value.texts = { ...DEFAULT_BRANDING.texts, ...(value.texts || {}) };
  for (const [key, text] of Object.entries(value.texts)) if (!TEXT_KEYS.includes(key) || typeof text !== 'string' || text.trim().length > 300) errors.push('Dicionário de textos inválido.');
  if (!Array.isArray(value.home_sections) || value.home_sections.length > 4) errors.push('Configure no máximo 4 seções na página inicial.');
  else {
    value.home_sections = value.home_sections.map((section) => ({ title: typeof section?.title === 'string' ? section.title.trim() : '', category_id: Number(section?.category_id) }));
    if (value.home_sections.some((section) => !section.title || section.title.length > 60 || !Number.isInteger(section.category_id) || section.category_id <= 0)) errors.push('Cada seção da página inicial precisa de título (até 60 caracteres) e categoria.');
  }
  return { errors, value };
}

function createBrandingRouter({ pool, authenticateToken } = {}) {
  const router = express.Router();
  const db = pool || require('../db').pool;
  const auth = authenticateToken || require('./user.routes').authenticateToken;

  router.get('/branding', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug,
                COALESCE(b.settings, $2::jsonb) AS branding
         FROM tenants t LEFT JOIN tenant_branding b ON b.tenant_id = t.id
         WHERE t.id = $1 LIMIT 1`,
        [req.tenant.id, JSON.stringify(DEFAULT_BRANDING)],
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Loja não encontrada.' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar branding:', error);
      return res.status(500).json({ error: 'Erro interno ao buscar identidade visual.' });
    }
  });

  router.put('/admin/branding', auth, async (req, res) => {
    const role = req.user.role || (req.user.is_admin ? 'admin' : 'customer');
    if (!getPermissions(role).includes(PERMISSIONS.STORE_SETTINGS_MANAGE)) return res.status(403).json({ error: 'Você não possui permissão para esta ação.' });
    const { errors, value } = validateBranding(req.body?.branding || {});
    if (errors.length) return res.status(400).json({ errors });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const tenantId = req.tenant.id;
      await client.query(`INSERT INTO tenant_branding (tenant_id, settings) VALUES ($1, $2::jsonb) ON CONFLICT (tenant_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`, [tenantId, JSON.stringify(value)]);
      await client.query('COMMIT');
      return res.json({ branding: value });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao salvar branding:', error);
      return res.status(500).json({ error: 'Erro interno ao salvar identidade visual.' });
    } finally { client.release(); }
  });

  router.get('/admin/branding', auth, async (req, res) => {
    const role = req.user.role || (req.user.is_admin ? 'admin' : 'customer');
    if (!getPermissions(role).includes(PERMISSIONS.STORE_SETTINGS_MANAGE)) return res.status(403).json({ error: 'Você não possui permissão para esta ação.' });
    try {
      const result = await db.query(`SELECT COALESCE(b.settings, $1::jsonb) AS branding FROM tenants t LEFT JOIN tenant_branding b ON b.tenant_id = t.id WHERE t.id=$2`, [JSON.stringify(DEFAULT_BRANDING), req.tenant.id]);
      return res.json(result.rows[0] || { branding: DEFAULT_BRANDING });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao buscar identidade visual.' }); }
  });
  return router;
}

module.exports = { createBrandingRouter, DEFAULT_BRANDING, contrastRatio, validateBranding };
