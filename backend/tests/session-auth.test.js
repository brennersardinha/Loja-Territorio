const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

jest.mock('../src/db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
const { pool } = require('../src/db');
const { authenticateToken, requirePermission, resolveUserRole } = require('../src/routes/user.routes');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function appFor(tenantId = 1) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.tenant = { id: tenantId, status: 'active' }; next(); });
  app.get('/private', authenticateToken, (req, res) => res.json({ role: req.user.role }));
  app.post('/admin', authenticateToken, requirePermission('products:write'), (req, res) => res.sendStatus(204));
  return app;
}

function activeSession(overrides = {}) {
  return { session_id: 'session-id', csrf_token_hash: hash('csrf-ok'), tenant_id: 1, membership_id: 8,
    id: 10, nome: 'Ana', email: 'ana@example.com', membership_role: 'owner', membership_status: 'active', ...overrides };
}

describe('sessao contextual e CSRF', () => {
  beforeEach(() => jest.clearAllMocks());

  test('nega sessao vinculada a outra loja com 403', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [activeSession()] });
    const response = await request(appFor(2)).get('/private').set('Cookie', 'ecommerce_session=token');
    expect(response.status).toBe(403);
  });

  test('membership removida invalida a sessao', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const response = await request(appFor()).get('/private').set('Cookie', 'ecommerce_session=revogada');
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie'].join(';')).toContain('Max-Age=0');
  });

  test('exige CSRF em mutacao autenticada por cookie', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [activeSession()] });
    const response = await request(appFor()).post('/admin').set('Cookie', 'ecommerce_session=token').send({});
    expect(response.status).toBe(403);
  });

  test('autoriza mutacao com CSRF e papel da membership', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [activeSession()] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const response = await request(appFor()).post('/admin').set('Cookie', 'ecommerce_session=token').set('X-CSRF-Token', 'csrf-ok').send({});
    expect(response.status).toBe(204);
  });

  test('somente a membership de dono concede papel administrativo', () => {
    expect(resolveUserRole({ membership_role: 'owner' })).toBe('admin');
    expect(resolveUserRole({ membership_role: 'customer' })).toBe('customer');
  });

  test('cliente autenticado nao executa mutacao administrativa', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [activeSession({ membership_role: 'customer' })] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const response = await request(appFor()).post('/admin').set('Cookie', 'ecommerce_session=token').set('X-CSRF-Token', 'csrf-ok').send({});
    expect(response.status).toBe(403);
  });
});
