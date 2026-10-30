const { getStoreInfo } = require('./store-info.service');
const { FIXED_SHIPPING_METHODS } = require('./shipping.service');

// Etiquetas só para pedidos com pagamento confirmado; pendentes, cancelados e devolvidos ficam de fora.
const LABEL_ELIGIBLE_STATUSES = Object.freeze(['paid', 'processing', 'shipped', 'delivered']);
const MAX_ORDERS_PER_BATCH = 100;
const MAX_VOLUMES = 50;

class LabelError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function parseOrderIds(value) {
  const ids = [...new Set((Array.isArray(value) ? value : []).map(Number))];
  if (!ids.length || ids.length > MAX_ORDERS_PER_BATCH || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new LabelError(`Informe de 1 a ${MAX_ORDERS_PER_BATCH} pedidos válidos.`);
  }
  return ids;
}

// Cria a etiqueta dos pedidos que ainda não têm; o código é sequencial, único e nunca reaproveitado.
// O lock serializa gerações simultâneas (ex.: dois cliques): sem ele, cada uma consumiria um número e a sequência teria buracos.
async function ensureLabels(db, tenantId, orderIds, userId) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const ownsTransaction = client !== db;
  try {
    if (ownsTransaction) await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('order_labels'), $1)", [tenantId]);
    await client.query(
      `INSERT INTO order_labels (tenant_id, order_id, code, created_by)
       SELECT o.tenant_id, o.id, 'ETQ-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('order_label_code_seq')::text, 6, '0'), $3
       FROM orders o
       WHERE o.tenant_id = $1 AND o.id = ANY($2::int[]) AND o.status = ANY($4::text[])
         AND NOT EXISTS (SELECT 1 FROM order_labels l WHERE l.tenant_id = o.tenant_id AND l.order_id = o.id)
       ORDER BY o.id
       ON CONFLICT (tenant_id, order_id) DO NOTHING`,
      [tenantId, orderIds, userId || null, LABEL_ELIGIBLE_STATUSES],
    );
    if (ownsTransaction) await client.query('COMMIT');
  } catch (error) {
    if (ownsTransaction) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
}

function serviceName(order) {
  if (order.shipping_address_snapshot?.type === 'pickup' || order.shipping_method === 'pickup') return 'Retirada na loja';
  return order.quote_service_name || FIXED_SHIPPING_METHODS[order.shipping_method]?.label || order.shipping_method;
}

function buildRecipient(order) {
  const address = order.shipping_address_snapshot || {};
  return {
    name: address.recipient_name || order.customer_name,
    email: order.customer_email,
    street: address.street || '',
    number: address.number || '',
    complement: address.complement || '',
    neighborhood: address.neighborhood || '',
    city: address.city || '',
    state: address.state || '',
    zip_code: address.zip_code || '',
    text_only: Boolean(address.is_text_only),
  };
}

// Remetente das etiquetas: dados cadastrados em "Dados da loja", com o endereço de retirada e o CEP de origem como reserva.
function buildSender(storeInfo, storeName) {
  const sender = storeInfo.sender || {};
  return {
    name: sender.name || storeName,
    document: sender.document || '',
    address: sender.address || storeInfo.pickup?.address || '',
    zip_code: sender.zip_code || String(process.env.SHIPPING_ORIGIN_ZIP || '').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
    phone: sender.phone || storeInfo.contact?.phone || storeInfo.contact?.whatsapp || '',
  };
}

// Consultas em sequência: também roda dentro de uma transação (um único client do pg).
async function loadLabelPayloads(db, tenantId, orderIds) {
  const ordersResult = await db.query(
      `SELECT o.id, o.public_reference, o.status, o.shipping_method, o.shipping_address_snapshot, o.total, o.created_at,
              u.nome AS customer_name, u.email AS customer_email, q.service_name AS quote_service_name,
              l.id AS label_id, l.code, l.volumes, l.weight_kg, l.print_count, l.last_printed_at, l.created_at AS label_created_at
       FROM orders o
       JOIN users u ON u.id = o.usuario_id
       JOIN order_labels l ON l.order_id = o.id AND l.tenant_id = o.tenant_id
       LEFT JOIN checkout_sessions cs ON cs.id = o.checkout_session_id AND cs.tenant_id = o.tenant_id
       LEFT JOIN shipping_quotes q ON q.id = cs.shipping_quote_id AND q.tenant_id = o.tenant_id
       WHERE o.tenant_id = $1 AND o.id = ANY($2::int[])
       ORDER BY o.id`,
      [tenantId, orderIds],
  );
  const itemsResult = await db.query(
      `SELECT oi.order_id, oi.nome_produto, oi.quantidade, p.sku, p.peso_kg, p.atributos_dinamicos
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.produto_id AND p.tenant_id = oi.tenant_id
       WHERE oi.tenant_id = $1 AND oi.order_id = ANY($2::int[])
       ORDER BY oi.order_id, oi.id`,
      [tenantId, orderIds],
  );
  const trackingResult = await db.query(
      `SELECT DISTINCT ON (order_id) order_id, carrier, tracking_code
       FROM shipping_tracking
       WHERE tenant_id = $1 AND order_id = ANY($2::int[]) AND tracking_code IS NOT NULL
       ORDER BY order_id, created_at DESC`,
      [tenantId, orderIds],
  );
  const storeInfo = await getStoreInfo(tenantId, db);
  const tenant = await db.query('SELECT COALESCE(b.settings->>\'store_name\', t.name) AS name FROM tenants t LEFT JOIN tenant_branding b ON b.tenant_id = t.id WHERE t.id = $1', [tenantId]);
  const sender = buildSender(storeInfo, tenant.rows[0]?.name || 'Loja');

  return ordersResult.rows.map((order) => {
    const items = itemsResult.rows.filter((item) => item.order_id === order.id).map((item) => ({
      name: item.nome_produto,
      sku: item.sku || '',
      quantity: Number(item.quantidade),
      unit: item.atributos_dinamicos?.Unidade || item.atributos_dinamicos?.unidade || 'un',
      weight_kg: Number(item.peso_kg || 0) * Number(item.quantidade),
    }));
    const estimatedWeight = Math.round(items.reduce((total, item) => total + item.weight_kg, 0) * 1000) / 1000;
    const tracking = trackingResult.rows.find((row) => row.order_id === order.id);
    return {
      label: {
        id: order.label_id,
        code: order.code,
        volumes: Number(order.volumes),
        weight_kg: order.weight_kg === null ? estimatedWeight || null : Number(order.weight_kg),
        weight_is_estimate: order.weight_kg === null,
        print_count: Number(order.print_count),
        last_printed_at: order.last_printed_at,
        created_at: order.label_created_at,
      },
      order: {
        id: order.id,
        reference: order.public_reference,
        status: order.status,
        created_at: order.created_at,
        total: Number(order.total),
        service: serviceName(order),
        is_pickup: serviceName(order) === 'Retirada na loja',
        items_count: items.reduce((total, item) => total + item.quantity, 0),
      },
      recipient: buildRecipient(order),
      sender,
      items: items.map(({ weight_kg, ...item }) => item),
      tracking: tracking ? { carrier: tracking.carrier || '', code: tracking.tracking_code } : null,
    };
  });
}

// Gera (se preciso) e devolve as etiquetas dos pedidos; pedidos inexistentes ou sem pagamento vêm em "skipped".
async function generateLabels(db, tenantId, orderIds, userId) {
  const ids = parseOrderIds(orderIds);
  const found = await db.query('SELECT id, status FROM orders WHERE tenant_id = $1 AND id = ANY($2::int[])', [tenantId, ids]);
  const statusById = new Map(found.rows.map((row) => [Number(row.id), row.status]));
  const skipped = [];
  const eligible = ids.filter((id) => {
    if (!statusById.has(id)) { skipped.push({ order_id: id, reason: 'Pedido não encontrado.' }); return false; }
    if (!LABEL_ELIGIBLE_STATUSES.includes(statusById.get(id))) { skipped.push({ order_id: id, reason: 'Pedido sem pagamento confirmado, cancelado ou devolvido.' }); return false; }
    return true;
  });
  if (eligible.length) await ensureLabels(db, tenantId, eligible, userId);
  const labels = eligible.length ? await loadLabelPayloads(db, tenantId, eligible) : [];
  return { labels, skipped };
}

function validateLabelUpdate(body = {}) {
  const volumes = Number(body.volumes);
  const hasWeight = body.weight_kg !== undefined && body.weight_kg !== null && body.weight_kg !== '';
  const weight = hasWeight ? Number(body.weight_kg) : null;
  const errors = [];
  if (!Number.isInteger(volumes) || volumes < 1 || volumes > MAX_VOLUMES) errors.push(`Volumes deve ser um número inteiro entre 1 e ${MAX_VOLUMES}.`);
  if (hasWeight && (!Number.isFinite(weight) || weight <= 0 || weight > 1000)) errors.push('Peso deve ser maior que zero e de até 1000 kg.');
  return { errors, data: { volumes, weight_kg: weight } };
}

module.exports = { LABEL_ELIGIBLE_STATUSES, MAX_ORDERS_PER_BATCH, LabelError, parseOrderIds, generateLabels, loadLabelPayloads, validateLabelUpdate, buildSender };
