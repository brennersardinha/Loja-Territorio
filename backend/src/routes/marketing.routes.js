const express = require('express');
const { getPermissions, PERMISSIONS } = require('../config/rbac');

const EMPTY_MARKETING = Object.freeze({ gtm_id: '', meta_pixel_id: '', robots_disallow: [] });

function validateMarketing(body = {}) {
  const gtm = String(body.gtm_id || '').trim();
  const pixel = String(body.meta_pixel_id || '').trim();
  const disallow = Array.isArray(body.robots_disallow) ? body.robots_disallow : [];
  const valid = (!gtm || /^GTM-[A-Z0-9]+$/.test(gtm)) && (!pixel || /^\d{5,20}$/.test(pixel)) && disallow.every((path) => /^\/[a-z0-9/_-]*$/i.test(path));
  return valid ? { gtm_id: gtm, meta_pixel_id: pixel, robots_disallow: disallow } : null;
}

function createMarketingRouter({ pool, authenticateToken } = {}) {
  const router = express.Router();
  const db = pool || require('../db').pool;
  const auth = authenticateToken || require('./user.routes').authenticateToken;
  const admin = [auth, (req, res, next) => (getPermissions(req.user.role || (req.user.is_admin ? 'admin' : 'customer')).includes(PERMISSIONS.STORE_SETTINGS_MANAGE)
    ? next()
    : res.status(403).json({ error: 'Voce nao possui permissao para esta acao.' }))];

  router.get('/marketing-config', async (req, res) => {
    try {
      const result = await db.query('SELECT settings FROM tenant_marketing_settings WHERE tenant_id=$1', [req.tenant.id]);
      return res.json({ marketing: result.rows[0]?.settings || {} });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao buscar configuracao.' }); }
  });

  router.get('/admin/marketing', ...admin, async (req, res) => {
    try {
      const result = await db.query('SELECT settings FROM tenant_marketing_settings WHERE tenant_id=$1', [req.tenant.id]);
      return res.json({ marketing: result.rows[0]?.settings || EMPTY_MARKETING });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao buscar configuracao.' }); }
  });

  router.put('/admin/marketing', ...admin, async (req, res) => {
    const settings = validateMarketing(req.body);
    if (!settings) return res.status(400).json({ error: 'Configuracao de marketing invalida.' });
    try {
      await db.query('INSERT INTO tenant_marketing_settings(tenant_id,settings) VALUES($1,$2::jsonb) ON CONFLICT(tenant_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=NOW()', [req.tenant.id, JSON.stringify(settings)]);
      return res.json({ marketing: settings });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao salvar configuracao.' }); }
  });

  return router;
}

module.exports = { createMarketingRouter, validateMarketing };
