const request = require('supertest');
const express = require('express');

const send = jest.fn();
jest.mock('../src/infrastructure/communications', () => ({ ResendEmail: class { send(payload) { return send(payload); } } }));
jest.mock('../src/db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
const { pool } = require('../src/db');
const routes = require('../src/routes/user.routes');

function app() {
  const instance = express();
  instance.use(express.json(), (req, _res, next) => { req.tenant = { id: 1, name: 'Loja Teste' }; req.requestId = 'req-1'; next(); }, routes);
  return instance;
}

describe('recuperação de senha', () => {
  const previousUrl = process.env.STORE_PUBLIC_URL;
  beforeEach(() => { pool.query.mockReset(); pool.connect.mockReset(); send.mockReset(); });
  afterAll(() => { if (previousUrl === undefined) delete process.env.STORE_PUBLIC_URL; else process.env.STORE_PUBLIC_URL = previousUrl; });

  test('não revela ausência de conta', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await request(app()).post('/password/forgot').send({ email: 'ausente@example.test' });
    expect(response.status).toBe(202); expect(send).not.toHaveBeenCalled();
  });
  test('envia link para a URL pública da loja e persiste somente o hash', async () => {
    process.env.STORE_PUBLIC_URL = 'https://minhaloja.com.br/';
    pool.query.mockResolvedValueOnce({ rows: [{ id: 4, email: 'dono@example.test' }], rowCount: 1 }).mockResolvedValue({ rows: [], rowCount: 1 });
    send.mockResolvedValue({ id: 'mail-1' });
    await request(app()).post('/password/forgot').send({ email: 'dono@example.test' }).expect(202);
    expect(pool.query.mock.calls[2][1][3]).toMatch(/^[a-f0-9]{64}$/);
    expect(send.mock.calls[0][0].text).toContain('https://minhaloja.com.br/conta?reset_token=');
  });
  test('rejeita token inexistente ou expirado', async () => {
    const query = jest.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({});
    pool.connect.mockResolvedValue({ query, release: jest.fn() });
    const response = await request(app()).post('/password/reset').send({ token: 'a'.repeat(43), senha: 'senha-segura-123' });
    expect(response.status).toBe(400);
    expect(query.mock.calls[1][1][1]).toBe(1);
  });
});
