const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('./user.routes');
const { enqueueWebhookEvent } = require('../services/webhook.service');
const { createPayment, verifyPayment, capturePayment, cancelPayment } = require('../services/payment.service');
const { getStoreInfo } = require('../services/store-info.service');
const { FIXED_SHIPPING_METHODS, getShippingProviders } = require('../services/shipping.service');

const router = express.Router();

const shippingMethods = {
  ...FIXED_SHIPPING_METHODS,
  pickup: { label: 'Retirada', cost: 0, eta_days: 1 },
};

const paymentMethods = {
  pix: { label: 'Pix sandbox' },
  card: { label: 'Cartao sandbox' },
  boleto: { label: 'Boleto sandbox' },
};

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getOrCreateCart(userId, tenantId, db = pool) {
  const existing = await db.query('SELECT id FROM carts WHERE usuario_id = $1 AND tenant_id=$2', [userId, tenantId]);

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const created = await db.query('INSERT INTO carts (usuario_id,tenant_id) VALUES ($1,$2) RETURNING id', [userId, tenantId]);
  return created.rows[0].id;
}

async function getCartSnapshot(userId, tenantId, db = pool) {
  const cartId = await getOrCreateCart(userId, tenantId, db);
  const result = await db.query(
    `SELECT ci.id, ci.produto_id, ci.quantidade, ci.preco_unitario,
            p.nome, p.descricao, p.preco AS preco_atual, p.estoque, p.categoria_id,
            c.nome AS categoria_nome
     FROM cart_items ci
     JOIN products p ON p.id = ci.produto_id AND p.tenant_id=ci.tenant_id
     LEFT JOIN categories c ON c.id = p.categoria_id AND c.tenant_id=p.tenant_id
     WHERE ci.cart_id = $1 AND ci.tenant_id=$2
     ORDER BY ci.id`,
    [cartId, tenantId],
  );

  const items = result.rows.map((item) => ({
    ...item,
    quantidade: Number(item.quantidade),
    preco_unitario: Number(item.preco_unitario),
    preco_atual: Number(item.preco_atual),
    estoque: Number(item.estoque),
  }));

  const subtotal = items.reduce(
    (total, item) => total + Number(item.preco_unitario || 0) * Number(item.quantidade || 0),
    0,
  );

  return { cartId, items, subtotal };
}

function validateShippingMethod(value) {
  return shippingMethods[value] ? value : null;
}

function validatePaymentMethod(value) {
  return paymentMethods[value] ? value : null;
}

function calculateShippingCost(method) {
  return shippingMethods[method]?.cost || 0;
}

function calculateCouponDiscount(coupon, subtotal) {
  if (!coupon || subtotal <= 0) {
    return 0;
  }

  if (coupon.discount_type === 'percent') {
    return Math.min(subtotal, (subtotal * Number(coupon.discount_value)) / 100);
  }

  return Math.min(subtotal, Number(coupon.discount_value));
}

async function getCouponByCode(code, tenantId, db = pool) {
  const result = await db.query(
    `SELECT *
     FROM coupons
     WHERE UPPER(code) = UPPER($1) AND tenant_id=$2`,
    [code, tenantId],
  );

  return result.rows[0] || null;
}

function validateAddressInput(body) {
  const errors = [];
  const label = normalizeText(body.label);
  const recipientName = normalizeText(body.recipient_name);
  const street = normalizeText(body.street);
  const number = normalizeText(body.number);
  const complement = normalizeText(body.complement);
  const neighborhood = normalizeText(body.neighborhood);
  const city = normalizeText(body.city);
  const state = normalizeText(body.state);
  const zipCode = normalizeText(body.zip_code);

  if (label.length < 2) {
    errors.push('Rótulo do endereço deve ter pelo menos 2 caracteres.');
  }

  if (recipientName.length < 2) {
    errors.push('Nome do destinatário deve ter pelo menos 2 caracteres.');
  }

  if (street.length < 3) {
    errors.push('Rua deve ter pelo menos 3 caracteres.');
  }

  if (city.length < 2) {
    errors.push('Cidade deve ter pelo menos 2 caracteres.');
  }

  if (state.length < 2) {
    errors.push('Estado deve ter pelo menos 2 caracteres.');
  }

  if (zipCode.length < 5) {
    errors.push('CEP deve ter pelo menos 5 caracteres.');
  }

  return {
    errors,
    data: {
      label,
      recipient_name: recipientName,
      street,
      number: number || null,
      complement: complement || null,
      neighborhood: neighborhood || null,
      city,
      state,
      zip_code: zipCode,
      is_default: body.is_default === true || body.is_default === 'true',
    },
  };
}

function buildAddressSnapshot(user, addressRecord, fallbackText) {
  if (addressRecord) {
    return addressRecord;
  }

  const text = normalizeText(fallbackText) || normalizeText(user.endereco);

  if (!text) {
    return null;
  }

  return {
    label: 'Endereço do perfil',
    recipient_name: user.nome,
    street: text,
    number: null,
    complement: null,
    neighborhood: null,
    city: null,
    state: null,
    zip_code: null,
    is_text_only: true,
  };
}

router.post('/checkout/start', authenticateToken, async (req, res) => {
  let shippingMethod = validateShippingMethod(req.body.shipping_method || 'standard');
  const paymentProvider = normalizeText(req.body.payment_provider || 'sandbox').toLowerCase();
  const paymentMethod = normalizeText(req.body.payment_method || 'pix').toLowerCase();
  const couponCode = normalizeText(req.body.coupon_code).toUpperCase();
  const fallbackAddressText = normalizeText(req.body.shipping_address_text);

  if (!shippingMethod && !req.body.shipping_quote_id) {
    return res.status(400).json({ error: 'Método de envio inválido.' });
  }

  const providerMethods = { sandbox: ['pix','card','boleto'], stripe: ['card'] };
  if (!providerMethods[paymentProvider]?.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Método de pagamento inválido.' });
  }

  try {
    const cart = await getCartSnapshot(req.user.id, req.tenant.id);

    if (cart.items.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio.' });
    }

    let addressRecord = null;

    if (req.body.address_id) {
      const addressId = Number(req.body.address_id);

      if (!Number.isInteger(addressId) || addressId <= 0) {
        return res.status(400).json({ error: 'Endereço inválido.' });
      }

      const addressResult = await pool.query(
        `SELECT id, usuario_id, label, recipient_name, street, number, complement, neighborhood,
                city, state, zip_code, is_default, created_at, updated_at
         FROM addresses
         WHERE id = $1 AND usuario_id = $2 AND tenant_id=$3`,
        [addressId, req.user.id, req.tenant.id],
      );

      addressRecord = addressResult.rows[0] || null;
    }

    const storeInfo = await getStoreInfo(req.tenant.id);
    const isPickup = shippingMethod === 'pickup' && !req.body.shipping_quote_id;
    if (FIXED_SHIPPING_METHODS[shippingMethod] && !req.body.shipping_quote_id && (await getShippingProviders(req.tenant.id)).length) {
      return res.status(400).json({ error: 'Calcule o frete pelo CEP para escolher a entrega.' });
    }

    let addressSnapshot;
    if (isPickup) {
      const { pickup } = storeInfo;
      if (!pickup.enabled) return res.status(400).json({ error: 'Retirada na loja indisponível.' });
      addressSnapshot = { type: 'pickup', label: 'Retirada na loja', recipient_name: req.user.nome, street: pickup.address, hours: pickup.hours, instructions: pickup.instructions, is_text_only: true };
    } else {
      addressSnapshot = buildAddressSnapshot(req.user, addressRecord, fallbackAddressText);
    }

    if (!addressSnapshot) {
      return res.status(400).json({ error: 'Informe um endereço de entrega.' });
    }

    let coupon = null;
    if (couponCode) {
      coupon = await getCouponByCode(couponCode, req.tenant.id);

      if (!coupon || !coupon.active) {
        return res.status(404).json({ error: 'Cupom não encontrado ou inativo.' });
      }

      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
        return res.status(400).json({ error: 'Cupom ainda não está válido.' });
      }

      if (coupon.ends_at && new Date(coupon.ends_at) < new Date()) {
        return res.status(400).json({ error: 'Cupom expirado.' });
      }

      if (Number(coupon.min_order_value) > cart.subtotal) {
        return res.status(400).json({ error: 'Cupom exige um valor mínimo de compra maior.' });
      }
    }

    let shippingCost = calculateShippingCost(shippingMethod);
    let shippingQuoteId = null;
    if (req.body.shipping_quote_id) {
      const quoteResult = await pool.query(`SELECT id,service_code,service_name,cost,destination_zip FROM shipping_quotes WHERE id=$1 AND usuario_id=$2 AND tenant_id=$3 AND expires_at>NOW()`,[req.body.shipping_quote_id,req.user.id,req.tenant.id]);
      if (!quoteResult.rowCount) return res.status(400).json({ error: 'Cotação de frete inválida ou expirada.' });
      const quote=quoteResult.rows[0],addressZip=String(addressSnapshot.zip_code||'').replace(/\D/g,'');
      if(addressZip&&addressZip!==quote.destination_zip)return res.status(400).json({error:'A cotação não corresponde ao CEP do endereço.'});
      shippingQuoteId=quote.id;shippingMethod=quote.service_code;shippingCost=Number(quote.cost);
    }
    const freeShippingMin = Number(storeInfo.shipping?.free_shipping_min || 0);
    if (!isPickup && freeShippingMin > 0 && cart.subtotal >= freeShippingMin) shippingCost = 0;
    const discountAmount = calculateCouponDiscount(coupon, cart.subtotal);
    const total = Math.max(0, cart.subtotal + shippingCost - discountAmount);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const sessionResult = await pool.query(
      `INSERT INTO checkout_sessions (
         tenant_id,usuario_id, cart_snapshot, subtotal, shipping_cost, discount_amount, total,
         shipping_method, payment_method, payment_provider, shipping_quote_id, address_snapshot, coupon_code,coupon_id, expires_at
       ) VALUES ($1,$2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13,$14, $15)
       RETURNING id, usuario_id, cart_snapshot, subtotal, shipping_cost, discount_amount, total,
                 shipping_method, payment_method, payment_provider, shipping_quote_id, address_snapshot, coupon_code, status, expires_at, created_at`,
      [
        req.tenant.id, req.user.id,
        JSON.stringify(cart.items),
        cart.subtotal,
        shippingCost,
        discountAmount,
        total,
        shippingMethod,
        paymentMethod,
        paymentProvider,
        shippingQuoteId,
        JSON.stringify(addressSnapshot),
        couponCode || null, coupon?.id || null,
        expiresAt,
      ],
    );

    const session=sessionResult.rows[0];
    const payment=await createPayment({provider:paymentProvider,sessionId:session.id,amount:total,currency:'BRL',method:paymentMethod,metadata:{checkout_session_id:session.id,payer:{email:req.user.email}}},req.tenant.id);
    await pool.query('UPDATE checkout_sessions SET payment_external_id=$1 WHERE id=$2 AND tenant_id=$3',[payment.external_id,session.id,req.tenant.id]);

    return res.status(201).json({
      checkout: {...session,payment_external_id:payment.external_id},
      payment: { provider:paymentProvider,status:payment.status,reference:payment.external_id,method:paymentMethod,...payment.client },
    });
  } catch (error) {
    console.error('Erro ao iniciar checkout:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno ao iniciar checkout.' });
  }
});

router.post('/orders', authenticateToken, async (req, res) => {
  const checkoutSessionId = Number(req.body.checkout_session_id);

  if (!Number.isInteger(checkoutSessionId) || checkoutSessionId <= 0) {
    return res.status(400).json({ error: 'Checkout inválido.' });
  }

  let verifiedPayment;
  let payment;
  try {
    const pending=await pool.query('SELECT payment_provider,payment_external_id,total FROM checkout_sessions WHERE id=$1 AND usuario_id=$2 AND tenant_id=$3',[checkoutSessionId,req.user.id,req.tenant.id]);
    if(!pending.rowCount)return res.status(404).json({error:'Sessão de checkout não encontrada.'});
    payment={provider:pending.rows[0].payment_provider,externalId:pending.rows[0].payment_external_id};
    verifiedPayment=await verifyPayment(payment,req.tenant.id);
    if(!verifiedPayment.confirmed)return res.status(402).json({error:'Pagamento ainda não confirmado.',payment_status:verifiedPayment.status});
    if(verifiedPayment.amount_cents!==undefined&&verifiedPayment.amount_cents!==Math.round(Number(pending.rows[0].total)*100))return res.status(409).json({error:'Valor autorizado difere do total do pedido.'});
  } catch(error) { return res.status(error.status||502).json({error:error.message||'Não foi possível confirmar o pagamento.'}); }
  const paymentReference = verifiedPayment.reference;
  // Libera a autorizacao quando o pedido nao pode ser concluido; o cliente nao e cobrado.
  const releasePayment = () => cancelPayment(payment, req.tenant.id).catch((error) => console.error('Falha ao cancelar autorização de pagamento:', error.message));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `SELECT *
       FROM checkout_sessions
       WHERE id = $1 AND usuario_id = $2 AND tenant_id=$3
       FOR UPDATE`,
      [checkoutSessionId, req.user.id, req.tenant.id],
    );

    if (sessionResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sessão de checkout não encontrada.' });
    }

    const checkoutSession = sessionResult.rows[0];

    if (checkoutSession.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Checkout já foi processado.' });
    }

    if (new Date(checkoutSession.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      await releasePayment();
      return res.status(400).json({ error: 'Sessão de checkout expirada.' });
    }

    const cartItems = Array.isArray(checkoutSession.cart_snapshot)
      ? checkoutSession.cart_snapshot
      : JSON.parse(JSON.stringify(checkoutSession.cart_snapshot || []));

    if (cartItems.length === 0) {
      await client.query('ROLLBACK');
      await releasePayment();
      return res.status(400).json({ error: 'Carrinho vazio.' });
    }

    const productIds = [...new Set(cartItems.map((item) => Number(item.produto_id)).filter((value) => Number.isInteger(value) && value > 0))];

    const productResult = await client.query(
      `SELECT id, nome, preco, estoque, sku
       FROM products
       WHERE id = ANY($1::int[]) AND tenant_id=$2
       FOR UPDATE`,
      [productIds, req.tenant.id],
    );

    if (productResult.rowCount !== productIds.length) {
      await client.query('ROLLBACK');
      await releasePayment();
      return res.status(400).json({ error: 'Um ou mais produtos do carrinho não estão mais disponíveis.' });
    }

    const productMap = new Map(productResult.rows.map((product) => [product.id, product]));

    for (const item of cartItems) {
      const product = productMap.get(Number(item.produto_id));

      if (!product || Number(item.quantidade) > Number(product.estoque)) {
        await client.query('ROLLBACK');
        await releasePayment();
        return res.status(400).json({ error: 'Estoque insuficiente para finalizar o pedido.' });
      }
    }

    const orderResult = await client.query(
      `INSERT INTO orders (
         tenant_id,usuario_id, checkout_session_id, shipping_address_snapshot, shipping_method, payment_method,
         subtotal, shipping_cost, discount_amount, total, coupon_code,coupon_id, status, payment_reference, payment_provider
       ) VALUES ($1,$2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11,$12, 'paid', $13, $14)
       RETURNING *`,
      [
        req.tenant.id, req.user.id,
        checkoutSession.id,
        JSON.stringify(checkoutSession.address_snapshot || null),
        checkoutSession.shipping_method,
        checkoutSession.payment_method,
        checkoutSession.subtotal,
        checkoutSession.shipping_cost,
        checkoutSession.discount_amount,
        checkoutSession.total,
        checkoutSession.coupon_code,checkoutSession.coupon_id,
        paymentReference,
        checkoutSession.payment_provider,
      ],
    );

    const order = orderResult.rows[0];

    for (const item of cartItems) {
      const product = productMap.get(Number(item.produto_id));

      await client.query(
        `INSERT INTO order_items (order_id, produto_id, nome_produto, quantidade, preco_unitario,tenant_id)
         VALUES ($1, $2, $3, $4, $5,$6)`,
        [order.id, product.id, item.nome, item.quantidade, item.preco_unitario,req.tenant.id],
      );

      const stockUpdate = await client.query(
        'UPDATE products SET estoque = estoque - $1 WHERE id = $2 AND tenant_id=$3 AND estoque >= $1 RETURNING id',
        [item.quantidade, product.id, req.tenant.id],
      );
      if (!stockUpdate.rowCount) {
        await client.query('ROLLBACK');
        await releasePayment();
        return res.status(409).json({ error: 'Estoque foi alterado durante a finalização. Tente novamente.' });
      }
    }

    if (checkoutSession.coupon_code) {
      const coupon = await getCouponByCode(checkoutSession.coupon_code, req.tenant.id, client);

      if (coupon) {
        if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
          await client.query('ROLLBACK');
          await releasePayment();
          return res.status(400).json({ error: 'Cupom esgotado.' });
        }

        await client.query('UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id=$2', [coupon.id,req.tenant.id]);
      }
    }

    const cartId = await getOrCreateCart(req.user.id, req.tenant.id, client);
    await client.query('DELETE FROM cart_items WHERE cart_id = $1 AND tenant_id=$2', [cartId,req.tenant.id]);
    await client.query('UPDATE carts SET updated_at = NOW() WHERE id = $1 AND tenant_id=$2', [cartId,req.tenant.id]);
    await client.query("UPDATE checkout_sessions SET status = 'completed' WHERE id = $1 AND tenant_id=$2", [checkoutSession.id,req.tenant.id]);
    await client.query(
      'INSERT INTO order_status_history (order_id, status, notes,tenant_id) VALUES ($1, $2, $3,$4)',
      [order.id, 'paid', `Pagamento confirmado (${checkoutSession.payment_provider}).`,req.tenant.id],
    );
    const webhookOrder = {...order,items:cartItems.map((item)=>({produto_id:item.produto_id,sku:productMap.get(Number(item.produto_id))?.sku||null,nome_produto:item.nome,quantidade:item.quantidade,preco_unitario:item.preco_unitario}))};
    await enqueueWebhookEvent(client,req.tenant.id,'order.created',{order:webhookOrder});
    await enqueueWebhookEvent(client,req.tenant.id,'payment.confirmed',{payment:{order_id:order.id,status:'confirmed',method:order.payment_method,reference:order.payment_reference,amount:order.total,currency:'BRL'}});

    await capturePayment(payment, req.tenant.id);
    await client.query('COMMIT');

    return res.status(201).json({
      order: {
        ...webhookOrder,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    await releasePayment();
    console.error('Erro ao finalizar pedido:', error);
    return res.status(500).json({ error: 'Erro interno ao finalizar pedido.' });
  } finally {
    client.release();
  }
});

router.get('/addresses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, usuario_id, label, recipient_name, street, number, complement, neighborhood,
              city, state, zip_code, is_default, created_at, updated_at
       FROM addresses
       WHERE usuario_id = $1 AND tenant_id=$2
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id,req.tenant.id],
    );

    return res.json({ items: result.rows });
  } catch (error) {
    console.error('Erro ao listar endereços:', error);
    return res.status(500).json({ error: 'Erro interno ao listar endereços.' });
  }
});

router.post('/addresses', authenticateToken, async (req, res) => {
  const { errors, data } = validateAddressInput(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (data.is_default) {
      await client.query('UPDATE addresses SET is_default = false WHERE usuario_id = $1 AND tenant_id=$2', [req.user.id,req.tenant.id]);
    }

    const result = await client.query(
      `INSERT INTO addresses (
         tenant_id,usuario_id, label, recipient_name, street, number, complement,
         neighborhood, city, state, zip_code, is_default
       ) VALUES ($1,$2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12)
       RETURNING id, usuario_id, label, recipient_name, street, number, complement, neighborhood,
                 city, state, zip_code, is_default, created_at, updated_at`,
      [
        req.tenant.id,req.user.id,
        data.label,
        data.recipient_name,
        data.street,
        data.number,
        data.complement,
        data.neighborhood,
        data.city,
        data.state,
        data.zip_code,
        data.is_default,
      ],
    );

    await client.query('COMMIT');
    return res.status(201).json({ address: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar endereço:', error);
    return res.status(500).json({ error: 'Erro interno ao criar endereço.' });
  } finally {
    client.release();
  }
});

router.put('/addresses/:id', authenticateToken, async (req, res) => {
  const addressId = Number(req.params.id);

  if (!Number.isInteger(addressId) || addressId <= 0) {
    return res.status(400).json({ error: 'Endereço inválido.' });
  }

  const { errors, data } = validateAddressInput(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM addresses WHERE id = $1 AND usuario_id = $2 AND tenant_id=$3',
      [addressId, req.user.id,req.tenant.id],
    );

    if (existing.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Endereço não encontrado.' });
    }

    if (data.is_default) {
      await client.query('UPDATE addresses SET is_default = false WHERE usuario_id = $1 AND tenant_id=$2', [req.user.id,req.tenant.id]);
    }

    const result = await client.query(
      `UPDATE addresses
       SET label = $1, recipient_name = $2, street = $3, number = $4, complement = $5,
           neighborhood = $6, city = $7, state = $8, zip_code = $9, is_default = $10,
           updated_at = NOW()
       WHERE id = $11 AND usuario_id = $12 AND tenant_id=$13
       RETURNING id, usuario_id, label, recipient_name, street, number, complement, neighborhood,
                 city, state, zip_code, is_default, created_at, updated_at`,
      [
        data.label,
        data.recipient_name,
        data.street,
        data.number,
        data.complement,
        data.neighborhood,
        data.city,
        data.state,
        data.zip_code,
        data.is_default,
        addressId,
        req.user.id,req.tenant.id,
      ],
    );

    await client.query('COMMIT');
    return res.json({ address: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar endereço:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar endereço.' });
  } finally {
    client.release();
  }
});

router.delete('/addresses/:id', authenticateToken, async (req, res) => {
  const addressId = Number(req.params.id);

  if (!Number.isInteger(addressId) || addressId <= 0) {
    return res.status(400).json({ error: 'Endereço inválido.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM addresses WHERE id = $1 AND usuario_id = $2 AND tenant_id=$3 RETURNING id',
      [addressId, req.user.id,req.tenant.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Endereço não encontrado.' });
    }

    return res.json({ message: 'Endereço removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover endereço:', error);
    return res.status(500).json({ error: 'Erro interno ao remover endereço.' });
  }
});

router.post('/coupons/validate', async (req, res) => {
  const code = normalizeText(req.body.code || req.body.coupon_code).toUpperCase();
  const subtotal = Math.max(0, Number(req.body.subtotal || 0));

  if (!code) {
    return res.status(400).json({ error: 'Informe um cupom.' });
  }

  if (Number.isNaN(subtotal)) {
    return res.status(400).json({ error: 'Subtotal inválido.' });
  }

  try {
    const coupon = await getCouponByCode(code, req.tenant.id);

    if (!coupon || !coupon.active) {
      return res.status(404).json({ error: 'Cupom não encontrado ou inativo.' });
    }

    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
      return res.status(400).json({ error: 'Cupom ainda não está válido.' });
    }

    if (coupon.ends_at && new Date(coupon.ends_at) < new Date()) {
      return res.status(400).json({ error: 'Cupom expirado.' });
    }

    if (Number(coupon.min_order_value) > subtotal) {
      return res.status(400).json({ error: 'Cupom exige um valor mínimo de compra maior.' });
    }

    const discountAmount = calculateCouponDiscount(coupon, subtotal);

    return res.json({
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_order_value: coupon.min_order_value,
      },
      discount_amount: discountAmount,
      total: Math.max(0, subtotal - discountAmount),
    });
  } catch (error) {
    console.error('Erro ao validar cupom:', error);
    return res.status(500).json({ error: 'Erro interno ao validar cupom.' });
  }
});

// Historico de pedidos do usuario (cliente)
router.get('/orders', authenticateToken, async (req, res) => {
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Math.min(Number(req.query.limit) > 0 ? Number(req.query.limit) : 20, 100);
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM orders WHERE usuario_id = $1 AND tenant_id=$2',
      [req.user.id,req.tenant.id],
    );

    const totalItems = countResult.rows[0]?.total || 0;

    const result = await pool.query(
      `SELECT id, public_reference, usuario_id, subtotal, shipping_cost, discount_amount, total, coupon_code,
              shipping_method, payment_method, status, payment_reference, created_at, updated_at
       FROM orders
       WHERE usuario_id = $1 AND tenant_id=$2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id,req.tenant.id, limit, offset],
    );

    return res.json({
      items: result.rows,
      pagination: {
        page,
        limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao listar pedidos do usuário:', error);
    return res.status(500).json({ error: 'Erro interno ao listar pedidos do usuário.' });
  }
});

// Rastreio de um pedido (cliente)
router.get('/orders/:id/track', authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Pedido inválido.' });
  }

  try {
    const orderResult = await pool.query(
      `SELECT id, public_reference, usuario_id, status, shipping_method, payment_method, created_at, updated_at
       FROM orders WHERE id = $1 AND usuario_id = $2 AND tenant_id=$3`,
      [orderId, req.user.id,req.tenant.id],
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const historyResult = await pool.query(
      `SELECT id, order_id, status, notes, created_at
       FROM order_status_history
       WHERE order_id = $1 AND tenant_id=$2
       ORDER BY created_at ASC, id ASC`,
      [orderId,req.tenant.id],
    );

    const trackingResult = await pool.query(
      `SELECT id, carrier, tracking_code, status, checkpoints, created_at, updated_at
       FROM shipping_tracking
       WHERE order_id = $1 AND tenant_id=$2
       ORDER BY created_at DESC`,
      [orderId,req.tenant.id],
    );

    return res.json({
      order: orderResult.rows[0],
      status_history: historyResult.rows,
      tracking: trackingResult.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar rastreamento do pedido:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar rastreamento do pedido.' });
  }
});

module.exports = router;
