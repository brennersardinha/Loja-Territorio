const express = require('express');
const request = require('supertest');
const { createInventoryRouter, hash } = require('../src/routes/inventory.routes');

const pass = (req, _res, next) => { req.tenant = req.tenant || { id: 1 }; next(); };
function appWith(db) {
  const app = express();
  app.use(express.json(), pass, createInventoryRouter({ db, auth: pass, permission: pass }));
  return app;
}

describe('consulta de saldo para reconciliacao (L4)', () => {
  test('exige X-API-Key antes de acessar o banco', async () => {
    const db = { query: jest.fn() };
    const response = await request(appWith(db)).get('/integrations/inventory');
    expect(response.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('retorna saldo paginado filtrado por SKU', async () => {
    const db = { query: jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 3, tenant_id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, sku: 'CAM-001', nome: 'Camiseta', estoque: 4, total: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) };
    const response = await request(appWith(db)).get('/integrations/inventory?sku=CAM-001&limit=10').set('X-API-Key', 'inv_chave');
    expect(response.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toEqual([hash('inv_chave')]);
    expect(db.query.mock.calls[1][1]).toEqual([1, 'CAM-001', 10, 0]);
    expect(response.body).toEqual({ items: [{ id: 9, sku: 'CAM-001', nome: 'Camiseta', estoque: 4 }], pagination: { page: 1, limit: 10, total_items: 1 } });
  });
});
