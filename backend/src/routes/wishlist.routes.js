const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('./user.routes');

const router = express.Router();

async function getWishlist(userId, tenantId) {
  const result = await pool.query(
    `SELECT wi.id, wi.produto_id, wi.created_at,
            p.nome, p.descricao, p.preco, p.estoque, p.categoria_id, p.slug,
            p.fotos_produto, p.foto_exibicao_fit, p.foto_exibicao_position,
            c.nome AS categoria_nome
     FROM wishlist_items wi
     JOIN products p ON p.id = wi.produto_id AND p.tenant_id=wi.tenant_id
     LEFT JOIN categories c ON c.id = p.categoria_id AND c.tenant_id=p.tenant_id
     WHERE wi.usuario_id = $1 AND wi.tenant_id=$2
     ORDER BY wi.created_at DESC`,
    [userId, tenantId],
  );

  return { items: result.rows };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    return res.json(await getWishlist(req.user.id, req.tenant.id));
  } catch (error) {
    console.error('Erro ao buscar lista de desejos:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar lista de desejos.' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const produtoId = Number(req.body.produto_id);

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    return res.status(400).json({ error: 'Produto inválido.' });
  }

  try {
    const productResult = await pool.query('SELECT id FROM products WHERE id = $1 AND tenant_id=$2', [produtoId, req.tenant.id]);

    if (productResult.rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    await pool.query(
      `INSERT INTO wishlist_items (usuario_id, produto_id,tenant_id)
       VALUES ($1, $2,$3)
       ON CONFLICT (tenant_id, usuario_id, produto_id) DO NOTHING`,
      [req.user.id, produtoId, req.tenant.id],
    );

    return res.status(201).json(await getWishlist(req.user.id, req.tenant.id));
  } catch (error) {
    console.error('Erro ao adicionar produto a lista de desejos:', error);
    return res.status(500).json({ error: 'Erro interno ao adicionar produto a lista de desejos.' });
  }
});

router.delete('/:produto_id', authenticateToken, async (req, res) => {
  const produtoId = Number(req.params.produto_id);

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    return res.status(400).json({ error: 'Produto inválido.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM wishlist_items WHERE usuario_id = $1 AND produto_id = $2 AND tenant_id=$3 RETURNING id',
      [req.user.id, produtoId, req.tenant.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado na lista de desejos.' });
    }

    return res.json(await getWishlist(req.user.id, req.tenant.id));
  } catch (error) {
    console.error('Erro ao remover produto da lista de desejos:', error);
    return res.status(500).json({ error: 'Erro interno ao remover produto da lista de desejos.' });
  }
});

module.exports = router;
