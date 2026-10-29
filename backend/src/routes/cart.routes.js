const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('./user.routes');

const router = express.Router();

function validateQuantity(value) {
  const quantity = Number(value);

  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

async function getOrCreateCart(userId, tenantId, db = pool) {
  const existing = await db.query(
    'SELECT id FROM carts WHERE usuario_id = $1 AND tenant_id = $2',
    [userId, tenantId],
  );

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const created = await db.query(
    'INSERT INTO carts (usuario_id,tenant_id) VALUES ($1,$2) RETURNING id',
    [userId, tenantId],
  );

  return created.rows[0].id;
}

async function getCartPayload(userId, tenantId) {
  const cartId = await getOrCreateCart(userId, tenantId);
  const result = await pool.query(
    `SELECT ci.id, ci.produto_id, ci.quantidade, ci.preco_unitario,
            p.nome, p.descricao, p.preco AS preco_atual, p.estoque, p.categoria_id,
            p.fotos_produto, p.foto_exibicao_fit, p.foto_exibicao_position,
            c.nome AS categoria_nome
     FROM cart_items ci
     JOIN products p ON p.id = ci.produto_id AND p.tenant_id=ci.tenant_id
     LEFT JOIN categories c ON c.id = p.categoria_id AND c.tenant_id=p.tenant_id
     WHERE ci.cart_id = $1 AND ci.tenant_id=$2
     ORDER BY ci.id`,
    [cartId, tenantId],
  );

  const subtotal = result.rows.reduce(
    (total, item) => total + Number(item.preco_unitario) * item.quantidade,
    0,
  );

  return {
    cart_id: cartId,
    items: result.rows,
    subtotal,
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    return res.json(await getCartPayload(req.user.id, req.tenant.id));
  } catch (error) {
    console.error('Erro ao buscar carrinho:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar carrinho.' });
  }
});

router.post('/add', authenticateToken, async (req, res) => {
  const produtoId = Number(req.body.produto_id);
  const quantidade = validateQuantity(req.body.quantidade || 1);

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    return res.status(400).json({ error: 'Produto invalido.' });
  }

  if (!quantidade) {
    return res.status(400).json({ error: 'Quantidade deve ser um inteiro positivo.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      'SELECT id, preco, estoque FROM products WHERE id = $1 AND tenant_id=$2 FOR UPDATE',
      [produtoId, req.tenant.id],
    );

    if (productResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Produto nao encontrado.' });
    }

    const product = productResult.rows[0];
    const cartId = await getOrCreateCart(req.user.id, req.tenant.id, client);
    const itemResult = await client.query(
      'SELECT id, quantidade FROM cart_items WHERE cart_id = $1 AND produto_id = $2 AND tenant_id=$3',
      [cartId, produtoId, req.tenant.id],
    );
    const nextQuantity = (itemResult.rows[0]?.quantidade || 0) + quantidade;

    if (nextQuantity > product.estoque) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Quantidade solicitada excede o estoque disponivel.' });
    }

    await client.query(
      `INSERT INTO cart_items (cart_id, produto_id, quantidade, preco_unitario,tenant_id)
       VALUES ($1, $2, $3, $4,$5)
       ON CONFLICT (cart_id, produto_id)
       DO UPDATE SET quantidade = EXCLUDED.quantidade,
                     preco_unitario = EXCLUDED.preco_unitario,
                     updated_at = NOW()`,
      [cartId, produtoId, nextQuantity, product.preco, req.tenant.id],
    );

    await client.query('UPDATE carts SET updated_at = NOW() WHERE id = $1 AND tenant_id=$2', [cartId, req.tenant.id]);
    await client.query('COMMIT');

    return res.status(201).json(await getCartPayload(req.user.id, req.tenant.id));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao adicionar item ao carrinho:', error);
    return res.status(500).json({ error: 'Erro interno ao adicionar item ao carrinho.' });
  } finally {
    client.release();
  }
});

router.put('/update/:item_id', authenticateToken, async (req, res) => {
  const itemId = Number(req.params.item_id);
  const quantidade = validateQuantity(req.body.quantidade);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Item invalido.' });
  }

  if (!quantidade) {
    return res.status(400).json({ error: 'Quantidade deve ser um inteiro positivo.' });
  }

  try {
    const cartId = await getOrCreateCart(req.user.id, req.tenant.id);
    const itemResult = await pool.query(
      `SELECT ci.id, p.estoque
       FROM cart_items ci
       JOIN products p ON p.id = ci.produto_id AND p.tenant_id=ci.tenant_id
       WHERE ci.id = $1 AND ci.cart_id = $2 AND ci.tenant_id=$3`,
      [itemId, cartId, req.tenant.id],
    );

    if (itemResult.rowCount === 0) {
      return res.status(404).json({ error: 'Item nao encontrado no carrinho.' });
    }

    if (quantidade > itemResult.rows[0].estoque) {
      return res.status(400).json({ error: 'Quantidade solicitada excede o estoque disponivel.' });
    }

    await pool.query(
      'UPDATE cart_items SET quantidade = $1, updated_at = NOW() WHERE id = $2 AND tenant_id=$3',
      [quantidade, itemId, req.tenant.id],
    );
    await pool.query('UPDATE carts SET updated_at = NOW() WHERE id = $1 AND tenant_id=$2', [cartId, req.tenant.id]);

    return res.json(await getCartPayload(req.user.id, req.tenant.id));
  } catch (error) {
    console.error('Erro ao atualizar item do carrinho:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar item do carrinho.' });
  }
});

router.delete('/remove/:item_id', authenticateToken, async (req, res) => {
  const itemId = Number(req.params.item_id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Item invalido.' });
  }

  try {
    const cartId = await getOrCreateCart(req.user.id, req.tenant.id);
    const result = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2 AND tenant_id=$3 RETURNING id',
      [itemId, cartId, req.tenant.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item nao encontrado no carrinho.' });
    }

    await pool.query('UPDATE carts SET updated_at = NOW() WHERE id = $1 AND tenant_id=$2', [cartId, req.tenant.id]);
    return res.json(await getCartPayload(req.user.id, req.tenant.id));
  } catch (error) {
    console.error('Erro ao remover item do carrinho:', error);
    return res.status(500).json({ error: 'Erro interno ao remover item do carrinho.' });
  }
});

module.exports = router;
