const express = require('express');
const request = require('supertest');
const { createTenantResolver } = require('../src/middleware/tenant');

function appWith(db) {
  const app = express();
  app.use(createTenantResolver({ db }));
  app.get('/', (req, res) => res.json({ tenant: req.tenant }));
  return app;
}

describe('loja unica', () => {
  test('carrega sempre a loja padrao, independentemente do hostname', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 1, slug: 'default', status: 'active' }] }) };
    const response = await request(appWith(db)).get('/').set('Host', 'qualquer.exemplo.com').set('X-Forwarded-Host', 'outra.exemplo.com');
    expect(response.status).toBe(200);
    expect(response.body.tenant.id).toBe(1);
    expect(db.query.mock.calls[0][1]).toEqual(['default']);
  });

  test('responde 503 quando as migrations ainda nao criaram a loja', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
    const response = await request(appWith(db)).get('/');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('STORE_NOT_CONFIGURED');
  });

  test('responde 500 sem detalhes quando o banco falha', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('conexao recusada')) };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(appWith(db)).get('/');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('conexao recusada');
  });
});
