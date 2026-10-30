const express = require('express');
const request = require('supertest');
const { createStoreRouter } = require('../src/routes/store.routes');
const { validateStoreInfo } = require('../src/services/store-info.service');

const auth = (req, _res, next) => { req.user = { role: req.get('x-role') || 'admin' }; next(); };
function appWith(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { id: 1 }; next(); });
  app.use('/api', createStoreRouter({ pool: db, authenticateToken: auth }));
  return app;
}

describe('dados da loja fisica', () => {
  const previousKey = process.env.STRIPE_PUBLISHABLE_KEY;
  afterEach(() => { if (previousKey === undefined) delete process.env.STRIPE_PUBLISHABLE_KEY; else process.env.STRIPE_PUBLISHABLE_KEY = previousKey; });

  test('retirada exige endereço e horário', () => {
    expect(validateStoreInfo({ pickup: { enabled: true } }).errors).toEqual(['Informe endereço e horário para ativar a retirada na loja.']);
    const valid = validateStoreInfo({ pickup: { enabled: true, address: ' Rua A, 10 ', hours: 'Seg a sex, 9h-18h' } });
    expect(valid.errors).toEqual([]);
    expect(valid.value.pickup.address).toBe('Rua A, 10');
  });

  test('rejeita tipos e tamanhos inválidos', () => {
    const { errors } = validateStoreInfo({ contact: { email: 'invalido', phone: 5 }, policies: { privacy: 'x'.repeat(20001) } });
    expect(errors).toEqual(expect.arrayContaining(['contact.phone deve ser texto.', 'policies.privacy deve ter no máximo 20000 caracteres.', 'E-mail de contato inválido.']));
  });

  test('vitrine recebe dados publicos e a chave pública do Stripe somente com a integração ativa', async () => {
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc';
    const db = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ value: { pickup: { enabled: true, address: 'Rua A', hours: '9h-18h' } } }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] }) };
    const response = await request(appWith(db)).get('/api/store-info');
    expect(response.status).toBe(200);
    expect(response.body.pickup).toMatchObject({ enabled: true, address: 'Rua A' });
    expect(response.body.policies).toEqual({ privacy: '', exchanges: '' });
    expect(response.body.payment.stripe_publishable_key).toBe('pk_test_abc');
  });

  test('nunca expoe chave secreta configurada por engano como pública', async () => {
    process.env.STRIPE_PUBLISHABLE_KEY = 'sk_live_segredo';
    const db = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rowCount: 1, rows: [{}] }) };
    const response = await request(appWith(db)).get('/api/store-info');
    expect(response.body.payment.stripe_publishable_key).toBeNull();
  });

  test('administrador salva dados validados', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }) };
    const response = await request(appWith(db)).put('/api/admin/store-info').send({ store_info: { policies: { exchanges: 'Trocas em 7 dias.' } } });
    expect(response.status).toBe(200);
    expect(JSON.parse(db.query.mock.calls[0][1][2]).policies.exchanges).toBe('Trocas em 7 dias.');
  });

  test('cliente não altera dados da loja', async () => {
    const response = await request(appWith({ query: jest.fn() })).put('/api/admin/store-info').set('x-role', 'customer').send({ store_info: {} });
    expect(response.status).toBe(403);
  });
});
