const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { pool } = require('../db');
const { incrementMetric, setGauge } = require('../monitoring/metrics');

const SUPPORTED_EVENTS = Object.freeze(['order.created', 'order.cancelled', 'payment.confirmed']);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.WEBHOOK_MAX_ATTEMPTS) || 6);
const TIMEOUT_MS = Math.max(1000, Number(process.env.WEBHOOK_TIMEOUT_MS) || 10000);

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const p = address.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254)
      || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)
      || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd')
      || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
  }
  return false;
}

function validateWebhookUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) return false;
    if (url.username || url.password || !url.hostname || url.port === '0') return false;
    if (url.hostname === 'localhost' || isPrivateIp(url.hostname)) return false;
    return true;
  } catch (_) { return false; }
}

async function assertPublicDestination(urlValue) {
  if (!validateWebhookUrl(urlValue)) throw new Error('Destino de webhook inseguro ou inválido.');
  const addresses = await dns.lookup(new URL(urlValue).hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Destino de webhook aponta para uma rede privada.');
  }
}

function signPayload(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function enqueueWebhookEvent(db, tenantId, eventType, data) {
  if (!SUPPORTED_EVENTS.includes(eventType)) throw new Error(`Evento de webhook não suportado: ${eventType}`);
  const eventId = crypto.randomUUID();
  const payload = { id: eventId, type: eventType, created_at: new Date().toISOString(), data };
  await db.query(
    `INSERT INTO webhook_deliveries (endpoint_id,event_id,event_type,payload,tenant_id)
     SELECT id,$1,$2::text,$3::jsonb,$4 FROM webhook_endpoints
     WHERE active=true AND events ? $2::text AND tenant_id=$4`,
    [eventId, eventType, JSON.stringify(payload),tenantId],
  );
  return payload;
}

function retryDelay(attempts) { return Math.min(3600, 30 * (2 ** Math.max(0, attempts - 1))); }

async function claimDeliveries(db, limit = 10) {
  const result = await db.query(
    `WITH selected AS (
       SELECT id FROM webhook_deliveries
       WHERE ((status IN ('pending','failed') AND next_attempt_at <= NOW())
          OR (status='processing' AND updated_at < NOW()-INTERVAL '2 minutes'))
         AND attempts < $1
       ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT $2
     ) UPDATE webhook_deliveries d SET status='processing',attempts=d.attempts+1,updated_at=NOW()
       FROM selected WHERE d.id=selected.id
       RETURNING d.*`,
    [MAX_ATTEMPTS, limit],
  );
  return result.rows;
}

async function deliverOne(delivery, db = pool, fetchImpl = global.fetch) {
  const endpoint = await db.query('SELECT url,secret,active FROM webhook_endpoints WHERE id=$1', [delivery.endpoint_id]);
  if (!endpoint.rowCount || !endpoint.rows[0].active) {
    await db.query("UPDATE webhook_deliveries SET status='failed',last_error='Endpoint removido ou inativo',next_attempt_at=NOW()+INTERVAL '100 years',updated_at=NOW() WHERE id=$1", [delivery.id]);
    return;
  }
  const { url, secret } = endpoint.rows[0];
  try {
    await assertPublicDestination(url);
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const response = await fetchImpl(url, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), body,
      headers: { 'content-type': 'application/json', 'user-agent': 'Ecommerce-Webhooks/1.0',
        'x-webhook-id': delivery.event_id, 'x-webhook-event': delivery.event_type,
        'x-webhook-timestamp': timestamp, 'x-webhook-signature': `sha256=${signPayload(secret, timestamp, body)}` },
    });
    const responseBody = (await response.text()).slice(0, 2000);
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { responseStatus: response.status, responseBody });
    await db.query("UPDATE webhook_deliveries SET status='delivered',response_status=$2,response_body=$3,last_error=NULL,delivered_at=NOW(),updated_at=NOW() WHERE id=$1", [delivery.id, response.status, responseBody]);
    incrementMetric('worker_jobs', { worker:'webhook', status:'success', tenant_id:delivery.tenant_id });
  } catch (error) {
    const terminal = delivery.attempts >= MAX_ATTEMPTS;
    await db.query(`UPDATE webhook_deliveries SET status='failed',response_status=$2,response_body=$3,last_error=$4,
      next_attempt_at=CASE WHEN $5 THEN NOW()+INTERVAL '100 years' ELSE NOW()+($6*INTERVAL '1 second') END,updated_at=NOW() WHERE id=$1`,
    [delivery.id, error.responseStatus || null, error.responseBody || null, String(error.message).slice(0, 500), terminal, retryDelay(delivery.attempts)]);
    incrementMetric('worker_jobs', { worker:'webhook', status:'failure', tenant_id:delivery.tenant_id });
    if (!terminal) incrementMetric('worker_retries', { worker:'webhook', tenant_id:delivery.tenant_id });
  }
}

async function processWebhookQueue(db = pool, fetchImpl = global.fetch) {
  const client = await db.connect();
  let deliveries;
  try { await client.query('BEGIN'); deliveries = await claimDeliveries(client); await client.query('COMMIT'); }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  await Promise.allSettled(deliveries.map((item) => deliverOne(item, db, fetchImpl)));
  const pending=await db.query("SELECT COUNT(*)::int count FROM webhook_deliveries WHERE status IN ('pending','processing','failed') AND attempts<$1",[MAX_ATTEMPTS]);
  setGauge('worker_queue_pending',pending.rows[0]?.count||0,{worker:'webhook'});
  setGauge('worker_last_success_timestamp',Math.floor(Date.now()/1000),{worker:'webhook'});
  return deliveries.length;
}

function startWebhookWorker(db = pool) {
  const interval = setInterval(() => processWebhookQueue(db).catch((e) => console.error('Erro no worker de webhooks:', e)), Number(process.env.WEBHOOK_POLL_MS) || 5000);
  interval.unref();
  processWebhookQueue(db).catch((e) => console.error('Erro no worker de webhooks:', e));
  return () => clearInterval(interval);
}

module.exports = { SUPPORTED_EVENTS, validateWebhookUrl, signPayload, enqueueWebhookEvent, processWebhookQueue, startWebhookWorker, deliverOne, claimDeliveries };
