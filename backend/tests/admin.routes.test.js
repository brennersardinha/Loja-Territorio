const request = require('supertest');
const express = require('express');
const { createAdminRouter } = require('../src/routes/admin.routes');

// Simple in-memory mock DB
function createMockDb() {
  const reviews = [
    { id: 1, produto_id: 4, usuario_id: 2, nota: 5, comentario: 'Excelente', moderation_status: 'pending' },
  ];

  return {
    async query(sql, params) {
      const s = sql.trim().toLowerCase();

      if (s.startsWith('update product_reviews')) {
        const [status, id] = params;
        const review = reviews.find((item) => item.id === id);
        if (!review) return { rowCount: 0, rows: [] };
        review.moderation_status = status;
        return { rowCount: 1, rows: [review] };
      }

      if (s.startsWith('delete from product_reviews')) {
        const id = params[0];
        const index = reviews.findIndex((item) => item.id === id);
        if (index === -1) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: reviews.splice(index, 1) };
      }

      // fallback empty
      return { rowCount: 0, rows: [] };
    },
    async connect() {
      return {
        query: this.query.bind(this),
        release: async () => {},
      };
    },
  };
}

function fakeAuthMiddleware(req, res, next) {
  req.tenant = { id: 1, slug: 'default', status: 'active' };
  req.requestId = 'test-request-id';
  // Allow tests to override role via header 'x-test-role'
  const testRole = req.headers['x-test-role'];
  if (testRole) {
    req.user = { id: 99, nome: 'Test User', email: 'test@example.com', is_admin: testRole === 'admin', role: testRole === 'customer' ? null : testRole };
  } else {
    // default admin
    req.user = { id: 1, nome: 'Admin User', email: 'admin@example.com', is_admin: false, role: 'admin' };
  }
  next();
}

describe('Admin moderation endpoints', () => {
  let app;

  beforeAll(() => {
    const mockDb = createMockDb();
    const adminRouter = createAdminRouter({ pool: mockDb, authenticateToken: fakeAuthMiddleware });

    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
  });

  test('PATCH /api/admin/reviews/:id approves a review for administrators', async () => {
    const res = await request(app)
      .patch('/api/admin/reviews/1')
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.review.moderation_status).toBe('approved');
  });

  test('review moderation is forbidden for customers', async () => {
    const res = await request(app)
      .patch('/api/admin/reviews/1')
      .set('x-test-role', 'customer')
      .send({ status: 'rejected' });

    expect(res.status).toBe(403);
  });

  test('DELETE /api/admin/reviews/:id removes a review for administrators', async () => {
    const res = await request(app).delete('/api/admin/reviews/1');
    expect(res.status).toBe(204);
  });
});
