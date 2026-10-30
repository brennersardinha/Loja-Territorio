const express = require('express');
const { PERMISSIONS, getPermissions } = require('../config/rbac');
const { generateLabels, loadLabelPayloads, validateLabelUpdate, LabelError } = require('../services/order-label.service');

// Motor de etiquetas: gera (uma por pedido), ajusta volumes/peso e registra impressões.
function createLabelRouter({ pool, authenticateToken } = {}) {
  const router = express.Router();
  const db = pool || require('../db').pool;
  const auth = authenticateToken || require('./user.routes').authenticateToken;
  const canOperateOrders = (req, res, next) => (getPermissions(req.user.role || (req.user.is_admin ? 'admin' : 'customer')).includes(PERMISSIONS.ORDERS_UPDATE_STATUS)
    ? next()
    : res.status(403).json({ error: 'Você não possui permissão para esta ação.' }));
  const guard = [auth, canOperateOrders];
  const fail = (res, error, fallback) => {
    if (error instanceof LabelError) return res.status(error.status).json({ error: error.message });
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
  };

  router.post('/labels', ...guard, async (req, res) => {
    try {
      return res.json(await generateLabels(db, req.tenant.id, req.body?.order_ids, req.user.id));
    } catch (error) { return fail(res, error, 'Erro interno ao gerar etiquetas.'); }
  });

  router.put('/orders/:id/label', ...guard, async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'Pedido inválido.' });
    const { errors, data } = validateLabelUpdate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    try {
      const updated = await db.query(
        'UPDATE order_labels SET volumes = $1, weight_kg = $2, updated_at = NOW() WHERE tenant_id = $3 AND order_id = $4 RETURNING id',
        [data.volumes, data.weight_kg, req.tenant.id, orderId],
      );
      if (!updated.rowCount) return res.status(404).json({ error: 'Gere a etiqueta do pedido antes de ajustá-la.' });
      const [label] = await loadLabelPayloads(db, req.tenant.id, [orderId]);
      return res.json({ label });
    } catch (error) { return fail(res, error, 'Erro interno ao atualizar etiqueta.'); }
  });

  // Chamado depois da impressão: mantém o histórico de quantas vezes cada etiqueta saiu.
  // Só conta etiquetas com peso e volumes informados; antes disso a etiqueta de envio não é emitida.
  router.post('/labels/printed', ...guard, async (req, res) => {
    const ids = [...new Set((Array.isArray(req.body?.label_ids) ? req.body.label_ids : []).map(Number))].filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length || ids.length > 100) return res.status(400).json({ error: 'Informe de 1 a 100 etiquetas.' });
    try {
      const result = await db.query(
        'UPDATE order_labels SET print_count = print_count + 1, last_printed_at = NOW() WHERE tenant_id = $1 AND id = ANY($2::int[]) AND weight_kg IS NOT NULL RETURNING id, print_count, last_printed_at',
        [req.tenant.id, ids],
      );
      return res.json({ labels: result.rows });
    } catch (error) { return fail(res, error, 'Erro interno ao registrar impressão.'); }
  });

  return router;
}

module.exports = { createLabelRouter };
