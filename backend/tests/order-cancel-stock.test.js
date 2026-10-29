const express = require('express');
const request = require('supertest');
const { createAdminRouter } = require('../src/routes/admin.routes');

function appWith(currentStatus, paymentProvider = 'stripe') {
  const queries = [];
  const client = {
    query: jest.fn(async (sql, params) => {
      queries.push({ sql: sql.trim(), params });
      if (sql.includes('FROM orders WHERE id = $1')) return { rowCount: 1, rows: [{ id: 5, status: currentStatus, usuario_id: 2, payment_provider: paymentProvider }] };
      if (sql.includes('UPDATE products p SET estoque')) return { rowCount: 1, rows: [{ produto_id: 9, sku: 'CAM-1', quantidade: 2, estoque: 7 }] };
      return { rowCount: 1, rows: [] };
    }),
    release: jest.fn(),
  };
  const db = { connect: async () => client, query: client.query };
  const auth = (req, _res, next) => { req.user = { id: 1, role: 'admin' }; req.tenant = { id: 1 }; next(); };
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ pool: db, authenticateToken: auth }));
  return { app, queries };
}

describe('cancelamento de pedido (L1/L2)', () => {
  test('devolve estoque, emite order.cancelled e pede estorno do pagamento capturado', async () => {
    const { app, queries } = appWith('paid');
    const response = await request(app).put('/api/admin/orders/5/status').send({ status: 'cancelled', notes: 'Cliente desistiu' });
    expect(response.status).toBe(200);
    expect(response.body.restored_items).toEqual([{ produto_id: 9, sku: 'CAM-1', quantidade: 2, estoque: 7 }]);
    expect(response.body.refund_required).toBe(true);
    const webhook = queries.find((q) => q.sql.includes('INSERT INTO webhook_deliveries'));
    expect(webhook.params[1]).toBe('order.cancelled');
    expect(JSON.parse(webhook.params[2]).data.order.items).toEqual([{ produto_id: 9, sku: 'CAM-1', quantidade: 2 }]);
  });

  test('repetir o cancelamento nao devolve estoque novamente', async () => {
    const { app, queries } = appWith('cancelled');
    const response = await request(app).put('/api/admin/orders/5/status').send({ status: 'cancelled', notes: 'Observacao' });
    expect(response.status).toBe(200);
    expect(response.body.restored_items).toEqual([]);
    expect(queries.some((q) => q.sql.includes('UPDATE products p SET estoque'))).toBe(false);
  });

  test('pedido ainda nao pago nao exige estorno', async () => {
    const { app } = appWith('pending');
    const response = await request(app).put('/api/admin/orders/5/status').send({ status: 'cancelled', notes: 'Pagamento nao concluido' });
    expect(response.body.refund_required).toBe(false);
  });
});
