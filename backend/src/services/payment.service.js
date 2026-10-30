const { pool } = require('../db');

class IntegrationError extends Error { constructor(message, status = 502) { super(message); this.status = status; } }
async function responseJson(response) { const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={raw:text.slice(0,500)};}if(!response.ok)throw new IntegrationError(data.message||data.error?.message||`Gateway respondeu HTTP ${response.status}`);return data; }
function envValue(settings, name) { const envName=settings?.[`${name}_env`];const value=envName&&process.env[envName];if(!value)throw new IntegrationError(`Credencial ${name}_env não configurada para o provedor.`,503);return value; }

// Fluxo em duas etapas: o pagamento e autorizado no checkout e so capturado (cobrado) depois que o
// pedido e a baixa de estoque forem gravados; se o pedido falhar, a autorizacao e cancelada.
const providers = {
  sandbox: {
    async create({ sessionId, method }) { return { external_id:`SANDBOX-${sessionId}`,status:'pending',client:{reference:`SANDBOX-${sessionId}`,method} }; },
    async verify({ externalId }) { return { confirmed:Boolean(externalId),reference:externalId }; },
    async capture() { return { captured: true }; },
    async cancel() { return { canceled: true }; },
  },
  stripe: {
    async request(settings, path, { method = 'GET', body, idempotencyKey } = {}) {
      const headers = { authorization: `Bearer ${envValue(settings, 'secret_key')}` };
      if (body) headers['content-type'] = 'application/x-www-form-urlencoded';
      if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
      return fetch(`${settings.api_url || 'https://api.stripe.com'}${path}`, { method, headers, body, signal: AbortSignal.timeout(10000) }).then(responseJson);
    },
    async create({ amount, currency, settings, metadata }) {
      const body = new URLSearchParams({
        amount: String(Math.round(amount * 100)),
        currency: currency.toLowerCase(),
        'payment_method_types[]': 'card',
        capture_method: 'manual',
        'metadata[checkout_session_id]': String(metadata.checkout_session_id),
      });
      const data = await this.request(settings, '/v1/payment_intents', { method: 'POST', body, idempotencyKey: `checkout-${metadata.checkout_session_id}` });
      return { external_id: data.id, status: data.status, client: { client_secret: data.client_secret } };
    },
    async verify({ externalId, settings }) {
      const data = await this.request(settings, `/v1/payment_intents/${encodeURIComponent(externalId)}`);
      return { confirmed: ['requires_capture', 'succeeded'].includes(data.status), reference: data.id, status: data.status, amount_cents: data.amount, currency: data.currency };
    },
    async capture({ externalId, settings }) {
      const current = await this.request(settings, `/v1/payment_intents/${encodeURIComponent(externalId)}`);
      if (current.status === 'succeeded') return { captured: true };
      const data = await this.request(settings, `/v1/payment_intents/${encodeURIComponent(externalId)}/capture`, { method: 'POST', idempotencyKey: `capture-${externalId}` });
      if (data.status !== 'succeeded') throw new IntegrationError(`Captura do pagamento retornou ${data.status}.`);
      return { captured: true };
    },
    async cancel({ externalId, settings }) {
      const data = await this.request(settings, `/v1/payment_intents/${encodeURIComponent(externalId)}/cancel`, { method: 'POST', idempotencyKey: `cancel-${externalId}` });
      return { canceled: data.status === 'canceled' };
    },
  },
};

// Sandbox confirma qualquer pagamento: nunca pode ficar disponivel em producao.
function isSandboxEnabled(env=process.env){return env.NODE_ENV==='production'?false:env.PAYMENT_SANDBOX_ENABLED!=='false';}
async function getPaymentProvider(name,tenantId,db=pool) { if(!providers[name])throw new IntegrationError('Provedor de pagamento inválido.',400);if(name==='sandbox'){if(!isSandboxEnabled())throw new IntegrationError('Pagamento de teste desativado neste ambiente.',400);return{name,settings:{},adapter:providers[name]};}const r=await db.query("SELECT settings FROM integration_settings WHERE provider=$1 AND kind='payment' AND active=true AND tenant_id=$2",[name,tenantId]);if(!r.rowCount)throw new IntegrationError('Provedor de pagamento indisponível.',400);return{name,settings:r.rows[0].settings||{},adapter:providers[name]}; }
async function createPayment(input,tenantId,db=pool){const p=await getPaymentProvider(input.provider,tenantId,db);return p.adapter.create({...input,settings:p.settings});}
async function verifyPayment(input,tenantId,db=pool){const p=await getPaymentProvider(input.provider,tenantId,db);return p.adapter.verify({...input,settings:p.settings});}
async function capturePayment(input,tenantId,db=pool){const p=await getPaymentProvider(input.provider,tenantId,db);return p.adapter.capture({...input,settings:p.settings});}
async function cancelPayment(input,tenantId,db=pool){const p=await getPaymentProvider(input.provider,tenantId,db);return p.adapter.cancel({...input,settings:p.settings});}
module.exports={providers,isSandboxEnabled,getPaymentProvider,createPayment,verifyPayment,capturePayment,cancelPayment,IntegrationError};
