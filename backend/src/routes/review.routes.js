const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('./user.routes');

const router = express.Router();

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validateReviewInput(body = {}) {
  const errors = [];
  const nota = Number(body.nota);
  const comentario = typeof body.comentario === 'string' ? body.comentario.trim() : '';

  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    errors.push('Nota deve ser um numero inteiro entre 1 e 5.');
  }

  if (comentario.length < 3 || comentario.length > 2000) {
    errors.push('Comentario deve ter entre 3 e 2000 caracteres.');
  }

  return { errors, data: { nota, comentario } };
}

// Listagem pública de avaliações de um produto.
router.get('/product/:produto_id', async (req, res) => {
  const produtoId = parsePositiveInteger(req.params.produto_id);
  const page = parsePositiveInteger(req.query.page) || 1;
  const limit = Math.min(parsePositiveInteger(req.query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  if (!produtoId) {
    return res.status(400).json({ error: 'Produto invalido.' });
  }

  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').vary('Host');
    const productResult = await pool.query('SELECT id FROM products WHERE id = $1 AND tenant_id=$2', [produtoId, req.tenant.id]);
    if (productResult.rowCount === 0) {
      return res.status(404).json({ error: 'Produto nao encontrado.' });
    }

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM product_reviews WHERE produto_id = $1 AND tenant_id=$2 AND moderation_status = 'approved'",
      [produtoId, req.tenant.id],
    );
    const reviewsResult = await pool.query(
      `SELECT r.id, r.produto_id, r.usuario_id, r.nota, r.comentario, r.created_at, r.updated_at,
              u.nome AS usuario_nome
       FROM product_reviews r
       JOIN users u ON u.id = r.usuario_id
       WHERE r.produto_id = $1 AND r.tenant_id=$2 AND r.moderation_status = 'approved'
       ORDER BY r.created_at DESC
       LIMIT $3 OFFSET $4`,
      [produtoId, req.tenant.id, limit, offset],
    );
    const total = countResult.rows[0].total;

    return res.json({
      items: reviewsResult.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Erro ao listar avaliacoes:', error);
    return res.status(500).json({ error: 'Erro interno ao listar avaliacoes.' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const produtoId = parsePositiveInteger(req.body.produto_id);
  const { errors, data } = validateReviewInput(req.body);

  if (!produtoId) errors.push('Produto deve ser um identificador inteiro positivo.');
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const productResult = await pool.query('SELECT id FROM products WHERE id = $1 AND tenant_id=$2', [produtoId, req.tenant.id]);
    if (productResult.rowCount === 0) {
      return res.status(404).json({ error: 'Produto nao encontrado.' });
    }

    const result = await pool.query(
      `INSERT INTO product_reviews (produto_id, usuario_id, nota, comentario,tenant_id)
       VALUES ($1, $2, $3, $4,$5)
       RETURNING id, produto_id, usuario_id, nota, comentario, moderation_status, created_at, updated_at`,
      [produtoId, req.user.id, data.nota, data.comentario, req.tenant.id],
    );
    return res.status(201).json({ review: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Voce ja avaliou este produto.' });
    }
    console.error('Erro ao criar avaliacao:', error);
    return res.status(500).json({ error: 'Erro interno ao criar avaliacao.' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const reviewId = parsePositiveInteger(req.params.id);
  const { errors, data } = validateReviewInput(req.body);

  if (!reviewId) errors.push('Avaliacao invalida.');
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const result = await pool.query(
      `UPDATE product_reviews
       SET nota = $1, comentario = $2, updated_at = NOW()
       WHERE id = $3 AND usuario_id = $4 AND tenant_id=$5
       RETURNING id, produto_id, usuario_id, nota, comentario, created_at, updated_at`,
      [data.nota, data.comentario, reviewId, req.user.id, req.tenant.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Avaliacao nao encontrada ou nao pertence ao usuario.' });
    }
    return res.json({ review: result.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar avaliacao:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar avaliacao.' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const reviewId = parsePositiveInteger(req.params.id);
  if (!reviewId) return res.status(400).json({ error: 'Avaliacao invalida.' });

  try {
    const result = await pool.query(
      'DELETE FROM product_reviews WHERE id = $1 AND usuario_id = $2 AND tenant_id=$3 RETURNING id',
      [reviewId, req.user.id, req.tenant.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Avaliacao nao encontrada ou nao pertence ao usuario.' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir avaliacao:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir avaliacao.' });
  }
});

module.exports = router;
