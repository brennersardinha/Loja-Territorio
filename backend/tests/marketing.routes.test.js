const express = require('express');
const request = require('supertest');
const { createMarketingRouter, validateMarketing } = require('../src/routes/marketing.routes');

const auth = (req, _res, next) => { req.user = { role: req.get('x-role') || 'admin' }; next(); };
function appWith(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { id: 1 }; next(); });
  app.use('/api', createMarketingRouter({ pool: db, authenticateToken: auth }));
  return app;
}

describe('marketing', () => {
  test('válida identificadores de rastreamento e caminhos do robots', () => {
    expect(validateMarketing({ gtm_id: 'GTM-AB12', meta_pixel_id: '123456', robots_disallow: ['/conta'] })).toEqual({ gtm_id: 'GTM-AB12', meta_pixel_id: '123456', robots_disallow: ['/conta'] });
    expect(validateMarketing({ gtm_id: '<script>' })).toBeNull();
    expect(validateMarketing({ robots_disallow: ['sem-barra'] })).toBeNull();
  });

  test('configuração pública retorna objeto vazio quando nada foi salvo', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const response = await request(appWith(db)).get('/api/marketing-config');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ marketing: {} });
  });

  test('salva configuração válida para o administrador', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }) };
    const response = await request(appWith(db)).put('/api/admin/marketing').send({ gtm_id: 'GTM-XYZ' });
    expect(response.status).toBe(200);
    expect(db.query.mock.calls[0][1][0]).toBe(1);
  });

  test('cliente não altera o rastreamento', async () => {
    const response = await request(appWith({ query: jest.fn() })).put('/api/admin/marketing').set('x-role', 'customer').send({});
    expect(response.status).toBe(403);
  });
});
