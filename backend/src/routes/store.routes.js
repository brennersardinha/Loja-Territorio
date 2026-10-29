const express = require('express');
const { getPermissions, PERMISSIONS } = require('../config/rbac');
const { validateStoreInfo, getStoreInfo, saveStoreInfo } = require('../services/store-info.service');
const { isSandboxEnabled } = require('../services/payment.service');

function createStoreRouter({ pool, authenticateToken } = {}) {
  const router = express.Router();
  const db = pool || require('../db').pool;
  const auth = authenticateToken || require('./user.routes').authenticateToken;
  const admin = [auth, (req, res, next) => (getPermissions(req.user.role || (req.user.is_admin ? 'admin' : 'customer')).includes(PERMISSIONS.STORE_SETTINGS_MANAGE)
    ? next()
    : res.status(403).json({ error: 'Voce nao possui permissao para esta acao.' }))];

  // Dados publicos usados pela vitrine: retirada, contato, politicas e meios de pagamento ativos.
  router.get('/store-info', async (req, res) => {
    try {
      const [info, stripe] = await Promise.all([
        getStoreInfo(req.tenant.id, db),
        db.query("SELECT 1 FROM integration_settings WHERE tenant_id=$1 AND provider='stripe' AND kind='payment' AND active=true", [req.tenant.id]),
      ]);
      const publishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
      return res.json({
        ...info,
        payment: {
          sandbox: isSandboxEnabled(),
          stripe_publishable_key: stripe.rowCount && /^pk_(test|live)_/.test(publishableKey) ? publishableKey : null,
        },
      });
    } catch (error) {
      console.error('Erro ao buscar dados da loja:', error);
      return res.status(500).json({ error: 'Erro interno ao buscar dados da loja.' });
    }
  });

  router.get('/admin/store-info', ...admin, async (req, res) => {
    try {
      return res.json({ store_info: await getStoreInfo(req.tenant.id, db) });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao buscar dados da loja.' }); }
  });

  router.put('/admin/store-info', ...admin, async (req, res) => {
    const { errors, value } = validateStoreInfo(req.body?.store_info || {});
    if (errors.length) return res.status(400).json({ errors });
    try {
      await saveStoreInfo(req.tenant.id, value, db);
      return res.json({ store_info: value });
    } catch (error) { return res.status(500).json({ error: 'Erro interno ao salvar dados da loja.' }); }
  });

  return router;
}

module.exports = { createStoreRouter };
