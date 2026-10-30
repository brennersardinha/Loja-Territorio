const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../src/db');
const reviewRoutes = require('../src/routes/review.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.tenant = { id: 1, slug: 'default', status: 'active' }; next(); });
  app.use('/api/reviews', reviewRoutes);
  return app;
}

function tokenForUser(id = 1) {
  return jwt.sign({ sub: id, email: `user${id}@example.com` }, process.env.JWT_SECRET || 'dev-secret-change-me');
}

function authenticatedUser(id = 1) {
  return { rowCount: 1, rows: [{ id, nome: 'Cliente', email: `user${id}@example.com`, is_admin: false, role: 'customer', membership_id: 2, membership_role: 'customer', membership_status: 'active' }] };
}

describe('Product review routes', () => {
  beforeEach(() => pool.query.mockReset());

  test('creates a review for an authenticated customer', async () => {
    pool.query
      .mockResolvedValueOnce(authenticatedUser())
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, produto_id: 7, usuario_id: 1, nota: 5, comentario: 'Produto excelente.' }] });

    const res = await request(createApp())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenForUser()}`)
      .send({ produto_id: 7, nota: 5, comentario: 'Produto excelente.' });

    expect(res.status).toBe(201);
    expect(res.body.review).toMatchObject({ id: 9, produto_id: 7, nota: 5 });
  });

  test('rejects an invalid review before querying the product', async () => {
    pool.query.mockResolvedValueOnce(authenticatedUser());

    const res = await request(createApp())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenForUser()}`)
      .send({ produto_id: 7, nota: 6, comentario: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/Nota/), expect.stringMatching(/Comentário/)]));
  });

  test('lists reviews for an existing product with pagination', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, produto_id: 7, nota: 4, comentario: 'Muito bom', usuario_nome: 'Cliente' }] });

    const res = await request(createApp()).get('/api/reviews/product/7?page=1&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 1, limit: 5, total: 1, total_pages: 1 });
  });

  test('updates only the review owned by the authenticated user', async () => {
    pool.query
      .mockResolvedValueOnce(authenticatedUser(3))
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, usuario_id: 3, nota: 4, comentario: 'Atualizada' }] });

    const res = await request(createApp())
      .put('/api/reviews/9')
      .set('Authorization', `Bearer ${tokenForUser(3)}`)
      .send({ nota: 4, comentario: 'Atualizada' });

    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1]).toEqual([4, 'Atualizada', 9, 3, 1]);
  });

  test('does not delete a review owned by another user', async () => {
    pool.query
      .mockResolvedValueOnce(authenticatedUser(3))
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(createApp())
      .delete('/api/reviews/9')
      .set('Authorization', `Bearer ${tokenForUser(3)}`);

    expect(res.status).toBe(404);
  });
});
