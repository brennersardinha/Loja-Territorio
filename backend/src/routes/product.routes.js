const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requirePermission } = require('./user.routes');
const { PERMISSIONS } = require('../config/rbac');
const { slugify } = require('./seo.routes');

const router = express.Router();

function validateProductInput({
  nome,
  descricao,
  preco,
  estoque,
  categoria_id,
  fotos_produto,
  atributos_dinamicos,
  foto_exibicao_fit,
  foto_exibicao_position,
  slug, meta_title, meta_description,
  sku, peso_kg=0.3, altura_cm=10, largura_cm=15, comprimento_cm=20,
}) {
  const errors = [];
  const precoNumber = Number(preco);
  const estoqueNumber = Number(estoque);
  const categoriaIdNumber = categoria_id === undefined || categoria_id === null || categoria_id === ''
    ? null
    : Number(categoria_id);
  let parsedPhotos = [];
  let parsedAttributes = {};
  const allowedFits = new Set(['cover', 'contain', 'fill', 'scale-down', 'none']);
  const allowedPositions = new Set(['center', 'top', 'bottom', 'left', 'right']);

  if (!nome || nome.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres.');
  }

  if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
    errors.push('Descrição deve ser um texto.');
  }

  if (preco === undefined || preco === null || Number.isNaN(precoNumber) || precoNumber < 0) {
    errors.push('Preço deve ser um número maior ou igual a zero.');
  }

  if (
    estoque === undefined
    || estoque === null
    || Number.isNaN(estoqueNumber)
    || !Number.isInteger(estoqueNumber)
    || estoqueNumber < 0
  ) {
    errors.push('Estoque deve ser um número inteiro maior ou igual a zero.');
  }

  if (categoriaIdNumber !== null && (!Number.isInteger(categoriaIdNumber) || categoriaIdNumber <= 0)) {
    errors.push('Categoria deve ser um identificador inteiro positivo.');
  }

  if (fotos_produto !== undefined && fotos_produto !== null && fotos_produto !== '') {
    if (typeof fotos_produto === 'string') {
      try {
        const parsedValue = JSON.parse(fotos_produto);
        parsedPhotos = Array.isArray(parsedValue)
          ? parsedValue
          : fotos_produto.split(/\r?\n|,/);
      } catch (error) {
        parsedPhotos = fotos_produto.split(/\r?\n|,/);
      }
    } else if (Array.isArray(fotos_produto)) {
      parsedPhotos = fotos_produto;
    } else {
      errors.push('Fotos do produto devem ser uma lista de URLs.');
    }
  }

  parsedPhotos = parsedPhotos
    .map((photo) => (typeof photo === 'string' ? photo.trim() : ''))
    .filter(Boolean);

  if (atributos_dinamicos !== undefined && atributos_dinamicos !== null && atributos_dinamicos !== '') {
    if (typeof atributos_dinamicos === 'string') {
      try {
        parsedAttributes = JSON.parse(atributos_dinamicos);
      } catch (error) {
        errors.push('Atributos dinâmicos devem conter um JSON válido.');
      }
    } else {
      parsedAttributes = atributos_dinamicos;
    }
  }

  const normalizedFit = foto_exibicao_fit ? String(foto_exibicao_fit).trim() : 'cover';
  const normalizedPosition = foto_exibicao_position ? String(foto_exibicao_position).trim() : 'center';

  if (!allowedFits.has(normalizedFit)) {
    errors.push('Modo da imagem inválido.');
  }

  if (!allowedPositions.has(normalizedPosition)) {
    errors.push('Posição da imagem inválida.');
  }
  if (meta_title && String(meta_title).length > 70) errors.push('Meta title deve ter no máximo 70 caracteres.');
  if (meta_description && String(meta_description).length > 160) errors.push('Meta description deve ter no máximo 160 caracteres.');
  const dimensions=[peso_kg,altura_cm,largura_cm,comprimento_cm].map(Number);
  if(dimensions.some(value=>!Number.isFinite(value)||value<=0))errors.push('Peso e dimensões devem ser numeros maiores que zero.');
  if(sku&&String(sku).trim().length>80)errors.push('SKU deve ter no máximo 80 caracteres.');

  if (
    parsedAttributes === null
    || typeof parsedAttributes !== 'object'
    || Array.isArray(parsedAttributes)
  ) {
    errors.push('Atributos dinâmicos devem ser um objeto JSON.');
  }

  return {
    errors,
    data: {
      nome: nome ? nome.trim() : '',
      descricao: descricao ? descricao.trim() : null,
      preco: precoNumber,
      estoque: estoqueNumber,
      categoria_id: categoriaIdNumber,
      fotos_produto: parsedPhotos,
      atributos_dinamicos: parsedAttributes,
      foto_exibicao_fit: normalizedFit,
      foto_exibicao_position: normalizedPosition,
      slug: slugify(slug || nome), meta_title: String(meta_title || '').trim() || null, meta_description: String(meta_description || '').trim() || null,
      sku:String(sku||'').trim()||null,peso_kg:dimensions[0],altura_cm:dimensions[1],largura_cm:dimensions[2],comprimento_cm:dimensions[3],
    },
  };
}

router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 12);
  const offset = (page - 1) * limit;
  const filters = ['p.tenant_id = $1'];
  const values = [req.tenant.id];

  if (!Number.isInteger(page) || page <= 0) {
    return res.status(400).json({ error: 'Página deve ser um número inteiro positivo.' });
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    return res.status(400).json({ error: 'Limite deve ser um número inteiro entre 1 e 50.' });
  }

  if (req.query.categoria_id) {
    const categoriaId = Number(req.query.categoria_id);

    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      return res.status(400).json({ error: 'Categoria deve ser um identificador inteiro positivo.' });
    }

    values.push(categoriaId);
    filters.push(`p.categoria_id = $${values.length}`);
  }

  if (req.query.min_preco) {
    const minPreco = Number(req.query.min_preco);

    if (Number.isNaN(minPreco) || minPreco < 0) {
      return res.status(400).json({ error: 'Preço mínimo deve ser maior ou igual a zero.' });
    }

    values.push(minPreco);
    filters.push(`p.preco >= $${values.length}`);
  }

  if (req.query.max_preco) {
    const maxPreco = Number(req.query.max_preco);

    if (Number.isNaN(maxPreco) || maxPreco < 0) {
      return res.status(400).json({ error: 'Preço máximo deve ser maior ou igual a zero.' });
    }

    values.push(maxPreco);
    filters.push(`p.preco <= $${values.length}`);
  }

  if (req.query.busca) {
    values.push(`%${req.query.busca.trim()}%`);
    filters.push(`(
      p.nome ILIKE $${values.length}
      OR p.descricao ILIKE $${values.length}
      OR p.sku ILIKE $${values.length}
      OR p.atributos_dinamicos::text ILIKE $${values.length}
    )`);
  }

  const whereClause = `WHERE ${filters.join(' AND ')}`;

  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').vary('Host');
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM products p
       ${whereClause}`,
      values,
    );

    const paginatedValues = [...values, limit, offset];
    const result = await pool.query(
          `SELECT p.id, p.nome, p.descricao, p.preco, p.estoque, p.categoria_id,
            c.nome AS categoria_nome, p.fotos_produto, p.atributos_dinamicos, p.foto_exibicao_fit, p.foto_exibicao_position, p.slug, p.meta_title, p.meta_description, p.sku, p.created_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.categoria_id AND c.tenant_id = p.tenant_id
       ${whereClause}
       ORDER BY p.id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      paginatedValues,
    );

    return res.json({
      items: result.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        total_pages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar produtos' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Produto inválido.' });
  }

  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').vary('Host');
    const result = await pool.query(
          `SELECT p.id, p.nome, p.descricao, p.preco, p.estoque, p.categoria_id,
            c.nome AS categoria_nome, p.fotos_produto, p.atributos_dinamicos, p.foto_exibicao_fit, p.foto_exibicao_position, p.slug, p.meta_title, p.meta_description, p.sku, p.created_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.categoria_id AND c.tenant_id = p.tenant_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, req.tenant.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    return res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar produto.' });
  }
});

// Com uma chave de sincronizacao de estoque ativa, o SKU e a chave de negocio e passa a ser obrigatorio.
async function skuRequiredError(data, tenantId) {
  if (data.sku) return null;
  const keys = await pool.query('SELECT 1 FROM inventory_api_keys WHERE tenant_id=$1 AND active=true LIMIT 1', [tenantId]);
  return keys.rowCount ? 'SKU é obrigatório enquanto a sincronização de estoque estiver ativa.' : null;
}

router.post('/', authenticateToken, requirePermission(PERMISSIONS.PRODUCTS_WRITE), async (req, res) => {
  const { errors, data } = validateProductInput(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  const skuError = await skuRequiredError(data, req.tenant.id);
  if (skuError) return res.status(400).json({ errors: [skuError] });

  try {
    const result = await pool.query(
      `INSERT INTO products (tenant_id,nome, descricao, preco, estoque, categoria_id, fotos_produto, atributos_dinamicos, foto_exibicao_fit, foto_exibicao_position, slug, meta_title, meta_description,sku,peso_kg,altura_cm,largura_cm,comprimento_cm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        req.tenant.id,
        data.nome,
        data.descricao,
        data.preco,
        data.estoque,
        data.categoria_id,
        JSON.stringify(data.fotos_produto),
        JSON.stringify(data.atributos_dinamicos),
        data.foto_exibicao_fit,
        data.foto_exibicao_position,
        data.slug,data.meta_title,data.meta_description,
        data.sku,data.peso_kg,data.altura_cm,data.largura_cm,data.comprimento_cm,
      ],
    );

    return res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug de produto já utilizado.' });
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Categoria não encontrada.' });
    }

    console.error('Erro ao cadastrar produto:', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar produto.' });
  }
});

router.put('/:id', authenticateToken, requirePermission(PERMISSIONS.PRODUCTS_WRITE), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Produto inválido.' });
  }

  const { errors, data } = validateProductInput(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  const skuError = await skuRequiredError(data, req.tenant.id);
  if (skuError) return res.status(400).json({ errors: [skuError] });

  try {
    const result = await pool.query(
      `UPDATE products
       SET nome = $1,
           descricao = $2,
           preco = $3,
           estoque = $4,
           categoria_id = $5,
           fotos_produto = $6,
           atributos_dinamicos = $7,
           foto_exibicao_fit = $8,
           foto_exibicao_position = $9, slug=$10, meta_title=$11, meta_description=$12,
           sku=$13,peso_kg=$14,altura_cm=$15,largura_cm=$16,comprimento_cm=$17
       WHERE id = $18 AND tenant_id = $19 RETURNING *`,
      [
        data.nome,
        data.descricao,
        data.preco,
        data.estoque,
        data.categoria_id,
        JSON.stringify(data.fotos_produto),
        JSON.stringify(data.atributos_dinamicos),
        data.foto_exibicao_fit,
        data.foto_exibicao_position,
        data.slug,data.meta_title,data.meta_description,
        data.sku,data.peso_kg,data.altura_cm,data.largura_cm,data.comprimento_cm,
        id, req.tenant.id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    return res.json({ product: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug de produto já utilizado.' });
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Categoria não encontrada.' });
    }

    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar produto.' });
  }
});

router.delete('/:id', authenticateToken, requirePermission(PERMISSIONS.PRODUCTS_WRITE), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Produto inválido.' });
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, req.tenant.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json({ message: 'Produto removido com sucesso.', id });
  } catch (error) {
    if (error.code === '23503') return res.status(409).json({ error: 'Produto possui pedidos ou registros associados e não pode ser excluido.' });
    console.error('Erro ao remover produto:', error);
    return res.status(500).json({ error: 'Erro interno ao remover produto.' });
  }
});

module.exports = router;
module.exports.validateProductInput = validateProductInput;
