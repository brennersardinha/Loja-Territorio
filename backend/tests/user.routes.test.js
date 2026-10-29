const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../src/db');
const userRoutes = require('../src/routes/user.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { id: 1, name: 'Loja', slug: 'default', status: 'active' }; next(); });
  app.use('/api/users', userRoutes);
  return app;
}

const token = (sub) => jwt.sign({ sub }, process.env.JWT_SECRET || 'dev-secret-change-me');
const user = (overrides) => ({ id: 1, nome: 'Ana', email: 'ana@example.com', endereco: null, created_at: '2024-01-01', membership_id: 3, membership_status: 'active', ...overrides });

describe('User routes', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('perfil do dono expõe papel admin e permissões administrativas', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [user({ membership_role: 'owner' })] });
    const res = await request(createApp()).get('/api/users/profile').set('Authorization', `Bearer ${token(1)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.permissions).toContain('products:write');
    expect(res.body.user).not.toHaveProperty('platform_role');
  });

  test('perfil do cliente nao possui permissões administrativas', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [user({ id: 2, membership_role: 'customer' })] });
    const res = await request(createApp()).get('/api/users/profile').set('Authorization', `Bearer ${token(2)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.permissions).toEqual([]);
  });

  test('a listagem de equipe nao existe na loja unica', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [user({ membership_role: 'owner' })] });
    const res = await request(createApp()).get('/api/users').set('Authorization', `Bearer ${token(1)}`);
    expect(res.status).toBe(404);
  });
});
