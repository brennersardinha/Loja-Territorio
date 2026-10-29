const express = require('express');

const { PERMISSIONS, getPermissions } = require('../config/rbac');
const { enqueueWebhookEvent } = require('../services/webhook.service');

const ORDER_TRANSITIONS = Object.freeze({
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: [],
  cancelled: [],
  returned: [],
});

function canTransitionOrder(from, to) {
  const current = String(from || '').toLowerCase();
  const next = String(to || '').toLowerCase();
  return current === next || Boolean(ORDER_TRANSITIONS[current]?.includes(next));
}

function createAdminRouter({ pool, authenticateToken } = {}) {
  const router = express.Router();

  // allow dependency injection for tests; fall back to real modules
  const db = pool || require('../db').pool;
  const auth = authenticateToken || require('./user.routes').authenticateToken;

  // Protect all admin routes with authentication; permissions are checked per endpoint.
  router.use(auth);

  function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.user.role || (req.user.is_admin ? 'admin' : 'customer');
    if (!getPermissions(role).includes(permission)) {
      return res.status(403).json({ error: 'Você não possui permissão para esta ação.' });
    }
    return next();
  };
}

const ORDER_LIST_SORTS = {
  created_at: 'o.created_at',
  total: 'o.total',
  status: 'o.status',
  customer: 'u.nome',
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateFilter(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : text;
}

function parseJsonValue(value, fallback) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value === undefined || value === null ? fallback : value;
}

function buildOrderListFilters(query, tenantId) {
  const values = [tenantId];
  const where = ['o.tenant_id = $1'];

  const addFilter = (sql, value) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };

  const search = normalizeText(query.search);
  const status = normalizeText(query.status).toLowerCase();
  const paymentMethod = normalizeText(query.payment_method).toLowerCase();
  const shippingMethod = normalizeText(query.shipping_method).toLowerCase();
  const dateFrom = parseDateFilter(query.date_from);
  const dateTo = parseDateFilter(query.date_to);
  const customerId = parsePositiveInteger(query.customer_id, null);
  const minTotal = query.min_total !== undefined && query.min_total !== ''
    ? Number(query.min_total)
    : null;
  const maxTotal = query.max_total !== undefined && query.max_total !== ''
    ? Number(query.max_total)
    : null;

  if (search) {
    values.push(`%${search}%`);
    const placeholder = `$${values.length}`;
    where.push(`(
      CAST(o.id AS TEXT) ILIKE ${placeholder}
      OR u.nome ILIKE ${placeholder}
      OR u.email ILIKE ${placeholder}
      OR o.coupon_code ILIKE ${placeholder}
      OR o.payment_reference ILIKE ${placeholder}
      OR o.public_reference ILIKE ${placeholder}
    )`);
  }

  if (status) {
    addFilter('LOWER(o.status) = ?', status);
  }

  if (paymentMethod) {
    addFilter('LOWER(o.payment_method) = ?', paymentMethod);
  }

  if (shippingMethod) {
    addFilter('LOWER(o.shipping_method) = ?', shippingMethod);
  }

  if (dateFrom) {
    addFilter('o.created_at >= ?::timestamptz', dateFrom);
  }

  if (dateTo) {
    addFilter('o.created_at < (?::date + INTERVAL \'1 day\')', dateTo);
  }

  if (customerId) {
    addFilter('o.usuario_id = ?', customerId);
  }

  if (Number.isFinite(minTotal)) {
    addFilter('o.total >= ?', minTotal);
  }

  if (Number.isFinite(maxTotal)) {
    addFilter('o.total <= ?', maxTotal);
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    values,
    filters: {
      search,
      status,
      payment_method: paymentMethod,
      shipping_method: shippingMethod,
      date_from: dateFrom,
      date_to: dateTo,
      customer_id: customerId,
      min_total: Number.isFinite(minTotal) ? minTotal : null,
      max_total: Number.isFinite(maxTotal) ? maxTotal : null,
    },
  };
}

router.get('/dashboard/metrics', requirePermission(PERMISSIONS.REPORTS_READ), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM memberships WHERE tenant_id=$1 AND status='active') AS total_usuarios,
        (SELECT COUNT(*)::int FROM products WHERE tenant_id=$1) AS total_produtos,
        (SELECT COUNT(*)::int FROM categories WHERE tenant_id=$1) AS total_categorias,
        (SELECT COALESCE(SUM(estoque), 0)::int FROM products WHERE tenant_id=$1) AS total_estoque,
        (SELECT COALESCE(SUM(preco * estoque), 0)::numeric(12, 2) FROM products WHERE tenant_id=$1) AS valor_estoque,
        (SELECT COUNT(*)::int FROM carts WHERE tenant_id=$1) AS carrinhos_criados,
        (SELECT COALESCE(SUM(quantidade), 0)::int FROM cart_items WHERE tenant_id=$1) AS itens_em_carrinhos,
        (SELECT COUNT(*)::int FROM wishlist_items WHERE tenant_id=$1) AS itens_em_listas_desejos
    `,[req.tenant.id]);

    const topProducts = await db.query(`
      SELECT p.id, p.nome, COALESCE(SUM(ci.quantidade), 0)::int AS quantidade_em_carrinhos
      FROM products p
      LEFT JOIN cart_items ci ON ci.produto_id = p.id AND ci.tenant_id=p.tenant_id
      WHERE p.tenant_id=$1
      GROUP BY p.id, p.nome
      ORDER BY quantidade_em_carrinhos DESC, p.nome ASC
      LIMIT 5
    `,[req.tenant.id]);

    return res.json({
      metrics: {
        ...result.rows[0],
        total_vendas: 0,
      },
      top_products: topProducts.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar metricas do dashboard:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar metricas do dashboard.' });
  }
});

// Moderacao de avaliacoes de produtos.
router.get('/reviews', requirePermission(PERMISSIONS.REVIEWS_MODERATE), async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = Math.min(parsePositiveInteger(req.query.limit, 20), 100);
  const offset = (page - 1) * limit;
  const requestedStatus = normalizeText(req.query.status).toLowerCase();
  const validStatuses = new Set(['pending', 'approved', 'rejected']);

  if (requestedStatus && !validStatuses.has(requestedStatus)) {
    return res.status(400).json({ error: 'Status de moderacao invalido.' });
  }

  const whereClause = requestedStatus ? 'WHERE r.tenant_id=$1 AND r.moderation_status = $2' : 'WHERE r.tenant_id=$1';
  const values = requestedStatus ? [req.tenant.id, requestedStatus] : [req.tenant.id];

  try {
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM product_reviews r ${whereClause}`,
      values,
    );
    const result = await db.query(
      `SELECT r.id, r.produto_id, r.usuario_id, r.nota, r.comentario, r.moderation_status, r.created_at, r.updated_at,
              p.nome AS produto_nome, u.nome AS usuario_nome
       FROM product_reviews r
       JOIN products p ON p.id = r.produto_id AND p.tenant_id=r.tenant_id
       JOIN users u ON u.id = r.usuario_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    const total = countResult.rows[0].total;
    return res.json({ items: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Erro ao listar avaliacoes para moderacao:', error);
    return res.status(500).json({ error: 'Erro interno ao listar avaliacoes.' });
  }
});

router.patch('/reviews/:id', requirePermission(PERMISSIONS.REVIEWS_MODERATE), async (req, res) => {
  const reviewId = parsePositiveInteger(req.params.id);
  const moderationStatus = normalizeText(req.body.status).toLowerCase();

  if (!reviewId) return res.status(400).json({ error: 'Avaliacao invalida.' });
  if (!['approved', 'rejected'].includes(moderationStatus)) {
    return res.status(400).json({ error: 'Status deve ser approved ou rejected.' });
  }

  try {
    const result = await db.query(
      `UPDATE product_reviews
       SET moderation_status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id=$3
       RETURNING id, produto_id, usuario_id, nota, comentario, moderation_status, created_at, updated_at`,
      [moderationStatus, reviewId,req.tenant.id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Avaliacao nao encontrada.' });
    return res.json({ review: result.rows[0] });
  } catch (error) {
    console.error('Erro ao moderar avaliacao:', error);
    return res.status(500).json({ error: 'Erro interno ao moderar avaliacao.' });
  }
});

router.delete('/reviews/:id', requirePermission(PERMISSIONS.REVIEWS_MODERATE), async (req, res) => {
  const reviewId = parsePositiveInteger(req.params.id);
  if (!reviewId) return res.status(400).json({ error: 'Avaliacao invalida.' });

  try {
    const result = await db.query('DELETE FROM product_reviews WHERE id = $1 AND tenant_id=$2 RETURNING id', [reviewId,req.tenant.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Avaliacao nao encontrada.' });
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir avaliacao na moderacao:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir avaliacao.' });
  }
});

  router.get('/settings', requirePermission(PERMISSIONS.STORE_SETTINGS_MANAGE), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT key, value, description FROM store_settings WHERE tenant_id=$1 ORDER BY key', [req.tenant.id],
    );

    const settings = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));

    return res.json({ settings });
  } catch (error) {
    console.error('Erro ao buscar configuracoes da loja:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar configuracoes da loja.' });
  }
  });

  router.put('/settings', requirePermission(PERMISSIONS.STORE_SETTINGS_MANAGE), async (req, res) => {
  const updates = req.body && typeof req.body === 'object' ? req.body : {};
  const allowedKeys = ['currency', 'tax_rates', 'shipping_methods', 'payment_methods'];
  const entries = [];

  allowedKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      entries.push({ key, value: parseJsonValue(updates[key], updates[key]) });
    }
  });

  if (entries.length === 0) {
    return res.status(400).json({ error: 'Nenhuma configuracao enviada.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    for (const entry of entries) {
      await client.query(
        `INSERT INTO store_settings (tenant_id,key, value, description)
         VALUES ($1,$2, $3::jsonb, $4)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [req.tenant.id,entry.key, JSON.stringify(entry.value), `Atualizado via admin`],
      );
    }

    await client.query('COMMIT');
    return res.json({ settings: Object.fromEntries(entries.map((entry) => [entry.key, entry.value])) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar configuracoes da loja:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar configuracoes da loja.' });
  } finally {
    client.release();
  }
  });

  router.get('/reports/sales', requirePermission(PERMISSIONS.REPORTS_READ), async (req, res) => {
  const dateFrom = req.query.date_from ? new Date(req.query.date_from) : null;
  const dateTo = req.query.date_to ? new Date(req.query.date_to) : null;

  if ((dateFrom && Number.isNaN(dateFrom.getTime())) || (dateTo && Number.isNaN(dateTo.getTime()))) {
    return res.status(400).json({ error: 'Datas invalidas.' });
  }

  const filters = ['tenant_id = $1'];
  const values = [req.tenant.id];

  if (dateFrom) {
    filters.push(`created_at >= $${values.length + 1}`);
    values.push(dateFrom.toISOString());
  }

  if (dateTo) {
    filters.push(`created_at < $${values.length + 1}`);
    values.push(dateTo.toISOString());
  }

  const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const summaryResult = await db.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COALESCE(SUM(total), 0)::numeric(12, 2) AS total_revenue,
         COALESCE(SUM(discount_amount), 0)::numeric(12, 2) AS total_discount,
         COALESCE(SUM(shipping_cost), 0)::numeric(12, 2) AS total_shipping
       FROM orders
       ${whereSql}`,
      values,
    );

    const dailyResult = await db.query(
      `SELECT
         DATE(created_at) AS day,
         COUNT(*)::int AS orders_count,
         COALESCE(SUM(total), 0)::numeric(12, 2) AS revenue
       FROM orders
       ${whereSql}
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      values,
    );

    return res.json({
      summary: summaryResult.rows[0],
      by_day: dailyResult.rows,
    });
  } catch (error) {
    console.error('Erro ao gerar relatorio de vendas:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar relatorio de vendas.' });
  }
});

  router.get('/coupons', requirePermission(PERMISSIONS.COUPONS_MANAGE), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, code, description, discount_type, discount_value, min_order_value, usage_limit, used_count, active, starts_at, ends_at, created_at, updated_at
       FROM coupons WHERE tenant_id=$1
       ORDER BY created_at DESC`,
      [req.tenant.id],
    );

    return res.json({ items: result.rows });
  } catch (error) {
    console.error('Erro ao listar cupons:', error);
    return res.status(500).json({ error: 'Erro interno ao listar cupons.' });
  }
  });

  router.post('/coupons', requirePermission(PERMISSIONS.COUPONS_MANAGE), async (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
  const discountType = typeof req.body.discount_type === 'string' ? req.body.discount_type.trim().toLowerCase() : 'percent';
  const discountValue = Number(req.body.discount_value);
  const minOrderValue = Number(req.body.min_order_value || 0);
  const usageLimit = req.body.usage_limit === '' || req.body.usage_limit === null || req.body.usage_limit === undefined ? null : Number(req.body.usage_limit);
  const active = req.body.active !== undefined ? Boolean(req.body.active) : true;
  const startsAt = typeof req.body.starts_at === 'string' && req.body.starts_at ? req.body.starts_at : null;
  const endsAt = typeof req.body.ends_at === 'string' && req.body.ends_at ? req.body.ends_at : null;

  if (!code) {
    return res.status(400).json({ error: 'Codigo do cupom e necessario.' });
  }

  if (!['percent', 'fixed'].includes(discountType) || Number.isNaN(discountValue)) {
    return res.status(400).json({ error: 'Tipo ou valor do cupom invalidos.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO coupons (tenant_id,code, description, discount_type, discount_value, min_order_value, usage_limit, active, starts_at, ends_at)
       VALUES ($1,$2, $3, $4, $5, $6, $7, $8, $9,$10)
       RETURNING id, code, description, discount_type, discount_value, min_order_value, usage_limit, used_count, active, starts_at, ends_at, created_at, updated_at`,
      [req.tenant.id,code, description, discountType, discountValue, minOrderValue, usageLimit, active, startsAt, endsAt],
    );

    return res.status(201).json({ coupon: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Cupom ja cadastrado.' });
    }

    console.error('Erro ao criar cupom:', error);
    return res.status(500).json({ error: 'Erro interno ao criar cupom.' });
  }
  });

  router.put('/coupons/:id', requirePermission(PERMISSIONS.COUPONS_MANAGE), async (req, res) => {
  const couponId = Number(req.params.id);

  if (!Number.isInteger(couponId) || couponId <= 0) {
    return res.status(400).json({ error: 'Cupom invalido.' });
  }

  const fields = [];
  const values = [];
  let index = 1;

  const code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : null;
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
  const discountType = typeof req.body.discount_type === 'string' ? req.body.discount_type.trim().toLowerCase() : null;
  const discountValue = req.body.discount_value === undefined ? null : Number(req.body.discount_value);
  const minOrderValue = req.body.min_order_value === undefined ? null : Number(req.body.min_order_value || 0);
  const usageLimit = req.body.usage_limit === undefined ? null : (req.body.usage_limit === '' || req.body.usage_limit === null ? null : Number(req.body.usage_limit));
  const active = req.body.active === undefined ? null : Boolean(req.body.active);
  const startsAt = req.body.starts_at === undefined ? null : (typeof req.body.starts_at === 'string' && req.body.starts_at ? req.body.starts_at : null);
  const endsAt = req.body.ends_at === undefined ? null : (typeof req.body.ends_at === 'string' && req.body.ends_at ? req.body.ends_at : null);

  if (code !== null) { fields.push(`code = $${index++}`); values.push(code); }
  if (description !== null) { fields.push(`description = $${index++}`); values.push(description); }
  if (discountType !== null) { fields.push(`discount_type = $${index++}`); values.push(discountType); }
  if (discountValue !== null) { fields.push(`discount_value = $${index++}`); values.push(discountValue); }
  if (minOrderValue !== null) { fields.push(`min_order_value = $${index++}`); values.push(minOrderValue); }
  if (usageLimit !== null) { fields.push(`usage_limit = $${index++}`); values.push(usageLimit); }
  if (active !== null) { fields.push(`active = $${index++}`); values.push(active); }
  if (startsAt !== null) { fields.push(`starts_at = $${index++}`); values.push(startsAt); }
  if (endsAt !== null) { fields.push(`ends_at = $${index++}`); values.push(endsAt); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
  }

  values.push(couponId,req.tenant.id);

  try {
    const result = await db.query(
      `UPDATE coupons
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} AND tenant_id=$${index + 1}
       RETURNING id, code, description, discount_type, discount_value, min_order_value, usage_limit, used_count, active, starts_at, ends_at, created_at, updated_at`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cupom nao encontrado.' });
    }

    return res.json({ coupon: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Cupom ja cadastrado.' });
    }

    console.error('Erro ao atualizar cupom:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar cupom.' });
  }
  });

  router.delete('/coupons/:id', requirePermission(PERMISSIONS.COUPONS_MANAGE), async (req, res) => {
  const couponId = Number(req.params.id);

  if (!Number.isInteger(couponId) || couponId <= 0) {
    return res.status(400).json({ error: 'Cupom invalido.' });
  }

  try {
    const result = await db.query('DELETE FROM coupons WHERE id = $1 AND tenant_id=$2 RETURNING id', [couponId,req.tenant.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cupom nao encontrado.' });
    }

    return res.json({ message: 'Cupom removido.' });
  } catch (error) {
    console.error('Erro ao remover cupom:', error);
    return res.status(500).json({ error: 'Erro interno ao remover cupom.' });
  }
  });

router.get('/orders', requirePermission(PERMISSIONS.ORDERS_READ), async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = Math.min(parsePositiveInteger(req.query.limit, 20), 100);
  const offset = (page - 1) * limit;
  const sortBy = ORDER_LIST_SORTS[req.query.sort_by] ? req.query.sort_by : 'created_at';
  const sortDirection = String(req.query.sort_direction).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const { whereSql, values, filters } = buildOrderListFilters(req.query, req.tenant.id);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM orders o
       JOIN users u ON u.id = o.usuario_id
       ${whereSql}`,
      values,
    );

    const totalItems = countResult.rows[0]?.total || 0;
    const listValues = [...values, limit, offset];
    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;

    const result = await db.query(
      `SELECT
         o.id,
         o.public_reference,
         o.usuario_id,
         o.subtotal,
         o.shipping_cost,
         o.discount_amount,
         o.total,
         o.coupon_code,
         o.shipping_method,
         o.payment_method,
         o.status,
         o.payment_reference,
         o.created_at,
         o.updated_at,
         u.nome AS customer_name,
         u.email AS customer_email,
         COALESCE(SUM(oi.quantidade), 0)::int AS items_count
       FROM orders o
       JOIN users u ON u.id = o.usuario_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereSql}
       GROUP BY o.id, u.id
       ORDER BY ${ORDER_LIST_SORTS[sortBy]} ${sortDirection}, o.id DESC
       LIMIT ${limitPlaceholder}
       OFFSET ${offsetPlaceholder}`,
      listValues,
    );

    return res.json({
      items: result.rows,
      pagination: {
        page,
        limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / limit),
      },
      sort: {
        sort_by: sortBy,
        sort_direction: sortDirection.toLowerCase(),
      },
      filters,
    });
  } catch (error) {
    console.error('Erro ao listar pedidos no admin:', error);
    return res.status(500).json({ error: 'Erro interno ao listar pedidos.' });
  }
});

router.get('/orders/:id', requirePermission(PERMISSIONS.ORDERS_READ), async (req, res) => {
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Pedido invalido.' });
  }

  try {
    const orderResult = await db.query(
      `SELECT
         o.id,
         o.public_reference,
         o.usuario_id,
         o.checkout_session_id,
         o.shipping_address_snapshot,
         o.shipping_method,
         o.payment_method,
         o.subtotal,
         o.shipping_cost,
         o.discount_amount,
         o.total,
         o.coupon_code,
         o.status,
         o.payment_reference,
         o.created_at,
         o.updated_at,
         u.nome AS customer_name,
         u.email AS customer_email,
         u.endereco AS customer_profile_address,
         u.created_at AS customer_created_at
       FROM orders o
       JOIN users u ON u.id = o.usuario_id
       WHERE o.id = $1 AND o.tenant_id=$2`,
      [orderId,req.tenant.id],
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Pedido nao encontrado.' });
    }

    const itemsResult = await db.query(
      `SELECT
         oi.id,
         oi.order_id,
         oi.produto_id,
         oi.nome_produto,
         oi.quantidade,
         oi.preco_unitario,
         (oi.quantidade * oi.preco_unitario)::numeric(10, 2) AS total_item,
         p.nome AS produto_nome_atual,
         p.estoque AS produto_estoque_atual,
         p.categoria_id
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.produto_id AND p.tenant_id=oi.tenant_id
       WHERE oi.order_id = $1 AND oi.tenant_id=$2
       ORDER BY oi.id`,
      [orderId,req.tenant.id],
    );

    const historyResult = await db.query(
      `SELECT id, order_id, status, notes, created_at
       FROM order_status_history
       WHERE order_id = $1 AND tenant_id=$2
       ORDER BY created_at ASC, id ASC`,
      [orderId,req.tenant.id],
    );

    const order = orderResult.rows[0];

    return res.json({
      order: {
        ...order,
        customer: {
          id: order.usuario_id,
          nome: order.customer_name,
          email: order.customer_email,
          endereco: order.customer_profile_address,
          created_at: order.customer_created_at,
        },
        items: itemsResult.rows,
        status_history: historyResult.rows,
      },
    });
  } catch (error) {
    console.error('Erro ao detalhar pedido no admin:', error);
    return res.status(500).json({ error: 'Erro interno ao detalhar pedido.' });
  }
});

router.get('/customers', requirePermission(PERMISSIONS.CUSTOMERS_READ), async (req, res) => {
  const search = (req.query.search || '').trim();

  try {
    const result = await db.query(
      `SELECT u.id, u.nome, u.email, u.endereco, u.created_at,
              COALESCE((SELECT COUNT(*) FROM orders o WHERE o.usuario_id = u.id AND o.tenant_id=$3), 0)::int AS total_pedidos,
              COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.usuario_id = u.id AND o.tenant_id=$3), 0)::numeric(12, 2) AS total_gasto,
              COALESCE((SELECT COUNT(*) FROM addresses a WHERE a.usuario_id = u.id AND a.tenant_id=$3), 0)::int AS total_enderecos
       FROM users u JOIN memberships m ON m.user_id=u.id AND m.tenant_id=$3 AND m.status='active'
       WHERE ($1 = '' OR u.nome ILIKE $2 OR u.email ILIKE $2)
       ORDER BY u.created_at DESC`,
      [search, `%${search}%`,req.tenant.id],
    );

    return res.json({ items: result.rows });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    return res.status(500).json({ error: 'Erro interno ao listar clientes.' });
  }
});

router.get('/customers/:id', requirePermission(PERMISSIONS.CUSTOMERS_READ), async (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: 'Cliente invalido.' });
  }

  try {
    const customerResult = await db.query(
      `SELECT u.id, u.nome, u.email, u.endereco, u.created_at,
              COALESCE((SELECT COUNT(*) FROM orders o WHERE o.usuario_id = u.id AND o.tenant_id=$2), 0)::int AS total_pedidos,
              COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.usuario_id = u.id AND o.tenant_id=$2), 0)::numeric(12, 2) AS total_gasto,
              COALESCE((SELECT COUNT(*) FROM addresses a WHERE a.usuario_id = u.id AND a.tenant_id=$2), 0)::int AS total_enderecos
       FROM users u JOIN memberships m ON m.user_id=u.id AND m.tenant_id=$2 AND m.status='active'
       WHERE u.id = $1`,
      [customerId,req.tenant.id],
    );

    if (customerResult.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    }

    const addressesResult = await db.query(
      `SELECT id, usuario_id, label, recipient_name, street, number, complement, neighborhood,
              city, state, zip_code, is_default, created_at, updated_at
       FROM addresses
       WHERE usuario_id = $1 AND tenant_id=$2
       ORDER BY is_default DESC, created_at DESC`,
      [customerId,req.tenant.id],
    );

    const ordersResult = await db.query(
      `SELECT id, public_reference, usuario_id, subtotal, shipping_cost, discount_amount, total, coupon_code,
              shipping_method, payment_method, status, payment_reference, created_at, updated_at
       FROM orders
       WHERE usuario_id = $1 AND tenant_id=$2
       ORDER BY created_at DESC
       LIMIT 10`,
      [customerId,req.tenant.id],
    );

    return res.json({
      customer: customerResult.rows[0],
      addresses: addressesResult.rows,
      orders: ordersResult.rows,
    });
  } catch (error) {
    console.error('Erro ao detalhar cliente:', error);
    return res.status(500).json({ error: 'Erro interno ao detalhar cliente.' });
  }
});

router.put('/customers/:id', requirePermission(PERMISSIONS.CUSTOMERS_WRITE), async (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: 'Cliente invalido.' });
  }

  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const endereco = typeof req.body.endereco === 'string' ? req.body.endereco.trim() : '';

  if (nome.length < 2) {
    return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres.' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalido.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET nome = $1, email = $2, endereco = $3
       WHERE id = $4 AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=users.id AND m.tenant_id=$5 AND m.status='active')
       RETURNING id, nome, email, endereco, created_at`,
      [nome, email, endereco || null, customerId,req.tenant.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    }

    return res.json({ customer: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }

    console.error('Erro ao atualizar cliente:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar cliente.' });
  }
});

// Atualizar status do pedido (admin)
router.put('/orders/:id/status', requirePermission(PERMISSIONS.ORDERS_UPDATE_STATUS), async (req, res) => {
  const orderId = Number(req.params.id);
  const newStatus = typeof req.body.status === 'string' ? req.body.status.trim().toLowerCase() : '';
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : null;

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Pedido invalido.' });
  }

  if (!Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, newStatus)) {
    return res.status(400).json({ error: 'Status de pedido inválido.' });
  }

  if (newStatus === 'cancelled' && !notes) {
    return res.status(400).json({ error: 'Informe o motivo do cancelamento.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query('SELECT id, status, usuario_id, payment_provider FROM orders WHERE id = $1 AND tenant_id=$2 FOR UPDATE', [orderId,req.tenant.id]);

    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido nao encontrado.' });
    }

    const currentStatus = orderResult.rows[0].status;
    const usuarioId = orderResult.rows[0].usuario_id || null;

    // valida transicao
    if (!canTransitionOrder(currentStatus, newStatus)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Transição de status inválida de ${currentStatus} para ${newStatus}.` });
    }

    await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id=$3', [newStatus, orderId,req.tenant.id]);

    let restoredItems = [];
    // Somente a transicao real para cancelado devolve estoque (cancelled -> cancelled apenas registra observacao).
    const cancelling = newStatus === 'cancelled' && currentStatus !== 'cancelled';
    if (cancelling) {
      const restored = await client.query(
        `UPDATE products p SET estoque = p.estoque + i.quantidade
         FROM (SELECT produto_id, SUM(quantidade)::int AS quantidade FROM order_items WHERE order_id=$1 AND tenant_id=$2 GROUP BY produto_id) i
         WHERE p.id = i.produto_id AND p.tenant_id = $2
         RETURNING p.id AS produto_id, p.sku, i.quantidade, p.estoque`,
        [orderId, req.tenant.id],
      );
      restoredItems = restored.rows;
      await enqueueWebhookEvent(client, req.tenant.id, 'order.cancelled', {
        order: { id: orderId, reason: notes, items: restoredItems.map(({ produto_id, sku, quantidade }) => ({ produto_id, sku, quantidade })) },
      });
    }

    await client.query(
      'INSERT INTO order_status_history (order_id, status, notes,tenant_id) VALUES ($1, $2, $3,$4)',
      [orderId, newStatus, notes,req.tenant.id],
    );
    await client.query(
      `INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,request_id,metadata)
       VALUES($1,$2,'order.status_changed','order',$3,$4,$5::jsonb)`,
      [req.tenant.id, req.user.id, String(orderId), req.requestId || null, JSON.stringify({ from: currentStatus, to: newStatus, notes })],
    );

    // Criar notificacao simples para o usuario
    try {
      if (usuarioId) {
        const payload = { from: currentStatus, to: newStatus, notes };
        await client.query(
          'INSERT INTO notifications (usuario_id, order_id, type, payload,tenant_id) VALUES ($1, $2, $3, $4,$5)',
          [usuarioId, orderId, 'order_status_changed', JSON.stringify(payload),req.tenant.id],
        );
      }
    } catch (nErr) {
      console.error('Falha ao criar notificacao (não crítica):', nErr);
    }

    await client.query('COMMIT');

    const paidOnline = cancelling && ['paid', 'processing', 'shipped', 'delivered'].includes(currentStatus) && orderResult.rows[0].payment_provider !== 'sandbox';
    return res.json({
      message: paidOnline ? 'Pedido cancelado e estoque devolvido. Estorne o pagamento no painel da Stripe.' : 'Status atualizado.',
      from: currentStatus, to: newStatus, restored_items: restoredItems, refund_required: paidOnline,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar status do pedido (admin):', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar status do pedido.' });
  } finally {
    client.release();
  }
});

// Endpoints adicionais de shipping_tracking (admin CRUD)
// Nota: esses endpoints estao registrados neste arquivo para facilitar o controle administrativo.

router.get('/shipping_tracking', requirePermission(PERMISSIONS.ORDERS_READ), async (req, res) => {
  const orderId = req.query.order_id ? Number(req.query.order_id) : null;

  try {
    const params = [req.tenant.id];
    let where = 'WHERE tenant_id=$1';

    if (orderId && Number.isInteger(orderId) && orderId > 0) {
      params.push(orderId);
      where += ' AND order_id = $2';
    }

    const result = await db.query(
      `SELECT id, order_id, carrier, tracking_code, status, checkpoints, created_at, updated_at
       FROM shipping_tracking
       ${where}
       ORDER BY created_at DESC`,
      params,
    );

    return res.json({ items: result.rows });
  } catch (error) {
    console.error('Erro ao listar shipping_tracking:', error);
    return res.status(500).json({ error: 'Erro interno ao listar shipping_tracking.' });
  }
});

router.post('/shipping_tracking', requirePermission(PERMISSIONS.ORDERS_UPDATE_STATUS), async (req, res) => {
  const orderId = Number(req.body.order_id);
  const carrier = typeof req.body.carrier === 'string' ? req.body.carrier.trim() : null;
  const trackingCode = typeof req.body.tracking_code === 'string' ? req.body.tracking_code.trim() : null;
  const status = typeof req.body.status === 'string' ? req.body.status.trim() : null;
  const checkpoints = Array.isArray(req.body.checkpoints) ? req.body.checkpoints : [];

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'order_id invalido.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO shipping_tracking (tenant_id,order_id, carrier, tracking_code, status, checkpoints)
       SELECT $1,$2,$3,$4,$5,$6::jsonb WHERE EXISTS(SELECT 1 FROM orders WHERE id=$2 AND tenant_id=$1)
       RETURNING id, order_id, carrier, tracking_code, status, checkpoints, created_at, updated_at`,
      [req.tenant.id,orderId, carrier, trackingCode, status, JSON.stringify(checkpoints)],
    );

    return res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar shipping_tracking:', error);
    return res.status(500).json({ error: 'Erro interno ao criar shipping_tracking.' });
  }
});

router.put('/shipping_tracking/:id', requirePermission(PERMISSIONS.ORDERS_UPDATE_STATUS), async (req, res) => {
  const id = Number(req.params.id);
  const carrier = typeof req.body.carrier === 'string' ? req.body.carrier.trim() : null;
  const trackingCode = typeof req.body.tracking_code === 'string' ? req.body.tracking_code.trim() : null;
  const status = typeof req.body.status === 'string' ? req.body.status.trim() : null;
  const checkpoints = Array.isArray(req.body.checkpoints) ? req.body.checkpoints : null;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id invalido.' });
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (carrier !== null) { fields.push(`carrier = $${idx++}`); values.push(carrier); }
    if (trackingCode !== null) { fields.push(`tracking_code = $${idx++}`); values.push(trackingCode); }
    if (status !== null) { fields.push(`status = $${idx++}`); values.push(status); }
    if (checkpoints !== null) { fields.push(`checkpoints = $${idx++}::jsonb`); values.push(JSON.stringify(checkpoints)); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    values.push(id,req.tenant.id);

    const result = await db.query(
      `UPDATE shipping_tracking SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND tenant_id=$${idx + 1}
       RETURNING id, order_id, carrier, tracking_code, status, checkpoints, created_at, updated_at`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de tracking nao encontrado.' });
    }

    return res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar shipping_tracking:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar shipping_tracking.' });
  }
});

router.delete('/shipping_tracking/:id', requirePermission(PERMISSIONS.ORDERS_UPDATE_STATUS), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id invalido.' });
  }

  try {
    const result = await db.query('DELETE FROM shipping_tracking WHERE id = $1 AND tenant_id=$2 RETURNING id', [id,req.tenant.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de tracking nao encontrado.' });
    }

    return res.json({ message: 'Registro removido.' });
  } catch (error) {
    console.error('Erro ao deletar shipping_tracking:', error);
    return res.status(500).json({ error: 'Erro interno ao deletar shipping_tracking.' });
  }
});

  // return the configured router
  return router;
}

// default export for existing imports
module.exports = createAdminRouter();
module.exports.createAdminRouter = createAdminRouter;
module.exports.ORDER_TRANSITIONS = ORDER_TRANSITIONS;
module.exports.canTransitionOrder = canTransitionOrder;
