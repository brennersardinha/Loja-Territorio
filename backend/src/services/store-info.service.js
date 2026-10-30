const { pool } = require('../db');

// Informacoes da loja fisica: retirada, contato e politicas. Texto puro (a vitrine nunca renderiza HTML).
const STORE_INFO_KEY = 'store_info';
const DEFAULT_STORE_INFO = Object.freeze({
  pickup: { enabled: false, address: '', hours: '', instructions: '' },
  contact: { email: '', phone: '', whatsapp: '' },
  policies: { privacy: '', exchanges: '' },
  // Pedido com subtotal a partir deste valor tem entrega gratis; 0 desativa a regra.
  shipping: { free_shipping_min: 0 },
});
const LIMITS = {
  pickup: { address: 300, hours: 300, instructions: 500 },
  contact: { email: 254, phone: 30, whatsapp: 30 },
  policies: { privacy: 20000, exchanges: 20000 },
};

function mergeStoreInfo(value = {}) {
  return {
    pickup: { ...DEFAULT_STORE_INFO.pickup, ...(value.pickup || {}) },
    contact: { ...DEFAULT_STORE_INFO.contact, ...(value.contact || {}) },
    policies: { ...DEFAULT_STORE_INFO.policies, ...(value.policies || {}) },
    shipping: { ...DEFAULT_STORE_INFO.shipping, ...(value.shipping || {}) },
  };
}

function validateStoreInfo(input = {}) {
  const errors = [];
  const value = mergeStoreInfo(input);
  for (const [group, fields] of Object.entries(LIMITS)) {
    for (const [field, max] of Object.entries(fields)) {
      const text = value[group][field];
      if (typeof text !== 'string') { errors.push(`${group}.${field} deve ser texto.`); continue; }
      value[group][field] = text.trim();
      if (value[group][field].length > max) errors.push(`${group}.${field} deve ter no máximo ${max} caracteres.`);
    }
  }
  value.pickup.enabled = value.pickup.enabled === true;
  const freeShippingMin = Number(value.shipping.free_shipping_min || 0);
  if (!Number.isFinite(freeShippingMin) || freeShippingMin < 0 || freeShippingMin > 1_000_000) errors.push('Valor mínimo para frete grátis inválido.');
  value.shipping.free_shipping_min = Number.isFinite(freeShippingMin) ? Math.max(0, Math.round(freeShippingMin * 100) / 100) : 0;
  if (value.pickup.enabled && (!value.pickup.address || !value.pickup.hours)) errors.push('Informe endereço e horário para ativar a retirada na loja.');
  if (value.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contact.email)) errors.push('E-mail de contato inválido.');
  return { errors, value };
}

async function getStoreInfo(tenantId, db = pool) {
  const result = await db.query('SELECT value FROM store_settings WHERE tenant_id=$1 AND key=$2', [tenantId, STORE_INFO_KEY]);
  return mergeStoreInfo(result.rows[0]?.value || {});
}

async function saveStoreInfo(tenantId, value, db = pool) {
  await db.query(
    `INSERT INTO store_settings (tenant_id, key, value, description) VALUES ($1, $2, $3::jsonb, 'Retirada, contato e politicas da loja')
     ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [tenantId, STORE_INFO_KEY, JSON.stringify(value)],
  );
}

module.exports = { DEFAULT_STORE_INFO, mergeStoreInfo, validateStoreInfo, getStoreInfo, saveStoreInfo };
