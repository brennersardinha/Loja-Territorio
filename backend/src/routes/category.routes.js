const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requirePermission } = require('./user.routes');
const { PERMISSIONS } = require('../config/rbac');
const { slugify } = require('./seo.routes');

const router = express.Router();

function validateCategoryInput({ nome, descricao, parent_id, slug, meta_title, meta_description }, currentId = null) {
  const errors = [];
  const parentIdNumber = parent_id === undefined || parent_id === null || parent_id === ''
    ? null
    : Number(parent_id);

  if (!nome || nome.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres.');
  }

  if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
    errors.push('Descricao deve ser um texto.');
  }

  if (parentIdNumber !== null && (!Number.isInteger(parentIdNumber) || parentIdNumber <= 0)) {
    errors.push('Categoria pai deve ser um identificador inteiro positivo.');
  }

  if (currentId !== null && parentIdNumber === Number(currentId)) {
    errors.push('Categoria nao pode ser pai dela mesma.');
  }
  if (meta_title && String(meta_title).length > 70) errors.push('Meta title deve ter no maximo 70 caracteres.');
  if (meta_description && String(meta_description).length > 160) errors.push('Meta description deve ter no maximo 160 caracteres.');

  return {
    errors,
    data: {
      nome: nome ? nome.trim() : '',
      descricao: descricao ? descricao.trim() : null,
      parent_id: parentIdNumber,
      slug: slugify(slug || nome), meta_title: String(meta_title||'').trim()||null, meta_description:String(meta_description||'').trim()||null,
    },
  };
}

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').vary('Host');
    const result = await pool.query(
      `SELECT c.id, c.nome, c.descricao, c.parent_id, c.slug, c.meta_title, c.meta_description, p.nome AS parent_nome, c.created_at
       FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id AND p.tenant_id = c.tenant_id
       WHERE c.tenant_id = $1 ORDER BY c.nome`, [req.tenant.id],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar categorias.' });
  }
});

router.post('/', authenticateToken, requirePermission(PERMISSIONS.CATEGORIES_WRITE), async (req, res) => {
  const { errors, data } = validateCategoryInput(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (tenant_id,nome, descricao, parent_id,slug,meta_title,meta_description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.tenant.id,data.nome,data.descricao,data.parent_id,data.slug,data.meta_title,data.meta_description],
    );

    return res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug de categoria ja utilizado.' });
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Categoria pai nao encontrada.' });
    }

    console.error('Erro ao cadastrar categoria:', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar categoria.' });
  }
});

router.put('/:id', authenticateToken, requirePermission(PERMISSIONS.CATEGORIES_WRITE), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Categoria invalida.' });
  }

  const { errors, data } = validateCategoryInput(req.body, id);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const result = await pool.query(
      `UPDATE categories
       SET nome=$1,descricao=$2,parent_id=$3,slug=$4,meta_title=$5,meta_description=$6 WHERE id=$7 AND tenant_id=$8 RETURNING *`,
      [data.nome,data.descricao,data.parent_id,data.slug,data.meta_title,data.meta_description,id,req.tenant.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Categoria nao encontrada.' });
    }

    return res.json({ category: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug de categoria ja utilizado.' });
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Categoria pai nao encontrada.' });
    }

    console.error('Erro ao atualizar categoria:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar categoria.' });
  }
});

router.delete('/:id', authenticateToken, requirePermission(PERMISSIONS.CATEGORIES_WRITE), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Categoria invalida.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('UPDATE products SET categoria_id = NULL WHERE categoria_id = $1 AND tenant_id=$2', [id, req.tenant.id]);
    await client.query('UPDATE categories SET parent_id = NULL WHERE parent_id = $1 AND tenant_id=$2', [id, req.tenant.id]);

    const result = await client.query(
      'DELETE FROM categories WHERE id = $1 AND tenant_id=$2 RETURNING id',
      [id, req.tenant.id],
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Categoria nao encontrada.' });
    }

    await client.query('COMMIT');
    return res.json({ message: 'Categoria removida com sucesso.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao remover categoria:', error);
    return res.status(500).json({ error: 'Erro interno ao remover categoria.' });
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.validateCategoryInput = validateCategoryInput;
