const express = require('express');
const { pool } = require('../db');

const router = express.Router();
// Em producao a URL publica vem de STORE_PUBLIC_URL, nunca do cabecalho Host enviado pelo cliente.
function siteUrl(req) {
  const configured = String(process.env.STORE_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
}
function slugify(value) { return String(value || 'produto').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto'; }
function escapeXml(value) { return String(value).replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character])); }
router.get('/robots.txt', async (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600');
  try {
    const tenantId = req.tenant.id;
    const result = await pool.query("SELECT COALESCE(settings->'robots_disallow','[]'::jsonb) rules FROM tenant_marketing_settings WHERE tenant_id=$1", [tenantId]);
    const rules = result.rows[0]?.rules || [];
    return res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n${rules.map((rule) => `Disallow: ${rule}\n`).join('')}Sitemap: ${siteUrl(req)}/sitemap.xml\n`);
  } catch (error) { return res.status(500).send('Erro ao gerar robots.txt'); }
});

router.get('/sitemap.xml', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const products = await pool.query("SELECT id,nome,COALESCE(slug,'') slug,created_at FROM products WHERE tenant_id=$1 ORDER BY id", [tenantId]);
    const baseUrl = siteUrl(req);
    const urls = [`<url><loc>${escapeXml(`${baseUrl}/`)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...products.rows.map((item) => `<url><loc>${escapeXml(`${baseUrl}/produto/${item.id}/${item.slug || slugify(item.nome)}`)}</loc><lastmod>${new Date(item.created_at).toISOString().slice(0,10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`)];
    res.type('application/xml').set('Cache-Control','public, max-age=3600, stale-while-revalidate=86400');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  } catch (error) { console.error('Erro ao gerar sitemap:',error); return res.status(500).type('text/plain').send('Nao foi possivel gerar o sitemap.'); }
});

module.exports=router;module.exports.slugify=slugify;module.exports.escapeXml=escapeXml;module.exports.siteUrl=siteUrl;
