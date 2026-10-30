const crypto = require('crypto');
const { pool } = require('../db');

const STORE_SLUG = 'default';
const STORE_COLUMNS = 'id,name,slug,status,timezone,default_currency';

// Loja unica: todo request pertence a loja 'default', independentemente do hostname.
function createTenantResolver(options = {}) {
  const db = options.db || pool;
  return async function resolveTenantFromRequest(req, res, next) {
    try {
      const result = await db.query(`SELECT ${STORE_COLUMNS} FROM tenants WHERE slug=$1 LIMIT 1`, [STORE_SLUG]);
      const tenant = result.rows[0];
      if (!tenant) return res.status(503).json({ error: 'Loja ainda não foi configurada. Execute as migrations.', code: 'STORE_NOT_CONFIGURED' });
      req.tenant = tenant;
      return next();
    } catch (error) {
      console.error('Falha ao carregar a loja:', error);
      return res.status(500).json({ error: 'Erro interno ao carregar a loja.' });
    }
  };
}

function requestContextLogger(req, res, next) {
  const supplied = String(req.headers['x-request-id'] || '');
  req.requestId = /^[0-9a-f-]{36}$/i.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      event: 'http_request', request_id: req.requestId, tenant_id: req.tenant?.id || null,
      user_id: req.user?.id || null, method: req.method, path: req.originalUrl,
      status: res.statusCode, duration_ms: Date.now() - startedAt,
    }));
  });
  next();
}

function getTenantId(req) {
  const tenantId = Number(req?.tenant?.id);
  if (!Number.isInteger(tenantId) || tenantId < 1) {
    const error = new Error('Contexto da loja não foi resolvido.');
    error.status = 403;
    throw error;
  }
  return tenantId;
}

module.exports = { createTenantResolver, requestContextLogger, getTenantId };
