const express = require('express');
const request = require('supertest');
const { createStoreRouter } = require('../src/routes/store.routes');
const { createIntegrationRouter } = require('../src/routes/integration.routes');
const { validateStoreInfo } = require('../src/services/store-info.service');
const { validateBranding } = require('../src/routes/branding.routes');
const { validateCategoryInput } = require('../src/routes/category.routes');

function appWith(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { id: 1 }; next(); });
  app.use('/api', router);
  return app;
}

describe('frete na vitrine', () => {
  test('sem transportadora ativa a vitrine recebe os fretes fixos e o minimo para frete gratis', async () => {
    const db = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ value: { shipping: { free_shipping_min: 299 } } }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) };
    const response = await request(appWith(createStoreRouter({ pool: db, authenticateToken: (_req, _res, next) => next() }))).get('/api/store-info');
    expect(response.body.shipping).toMatchObject({ free_shipping_min: 299, quotes_enabled: false });
    expect(response.body.shipping.fixed_methods.map((method) => method.code)).toEqual(['standard', 'express']);
  });

  test('com transportadora ativa os fretes fixos deixam de ser oferecidos', async () => {
    const db = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] }) };
    const response = await request(appWith(createStoreRouter({ pool: db, authenticateToken: (_req, _res, next) => next() }))).get('/api/store-info');
    expect(response.body.shipping).toMatchObject({ quotes_enabled: true, fixed_methods: [] });
  });

  test('valor minimo para frete gratis precisa ser numero nao negativo', () => {
    expect(validateStoreInfo({ shipping: { free_shipping_min: -1 } }).errors).toContain('Valor mínimo para frete grátis inválido.');
    expect(validateStoreInfo({ shipping: { free_shipping_min: '149.9' } }).value.shipping.free_shipping_min).toBe(149.9);
  });

  test('visitante estima o frete do produto sem login e ganha frete gratis acima do minimo', async () => {
    const db = { query: jest.fn(async (sql) => {
      if (sql.includes('FROM products')) return { rowCount: 1, rows: [{ id: 5, preco: '150', peso_kg: 1, altura_cm: 10, largura_cm: 10, comprimento_cm: 10 }] };
      if (sql.includes('store_settings')) return { rows: [{ value: { shipping: { free_shipping_min: 250 } } }] };
      return { rowCount: 0, rows: [] };
    }) };
    const app = appWith(createIntegrationRouter({ db, auth: (_req, res) => res.status(401).end(), permission: () => (_req, _res, next) => next() }));
    const response = await request(app).post('/api/shipping/product-quotes').send({ product_id: 5, quantity: 2, destination_zip: '01001-000' });
    expect(response.status).toBe(200);
    expect(response.body.free_shipping).toBe(true);
    expect(response.body.quotes.every((quote) => quote.cost === 0)).toBe(true);
  });

  test('estimativa rejeita CEP incompleto antes de consultar o banco', async () => {
    const db = { query: jest.fn() };
    const app = appWith(createIntegrationRouter({ db, auth: (_req, _res, next) => next(), permission: () => (_req, _res, next) => next() }));
    const response = await request(app).post('/api/shipping/product-quotes').send({ product_id: 5, destination_zip: '0100' });
    expect(response.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('pagina inicial configuravel', () => {
  test('aceita ate 4 secoes com titulo e categoria', () => {
    const { errors, value } = validateBranding({ home_sections: [{ title: ' Novidades ', category_id: '3' }], texts: { hero_subtitle: 'Moda praia', hero_cta: 'Comprar' } });
    expect(errors).toEqual([]);
    expect(value.home_sections).toEqual([{ title: 'Novidades', category_id: 3 }]);
  });

  test('rejeita secao sem categoria e mais de 4 secoes', () => {
    expect(validateBranding({ home_sections: [{ title: 'Ofertas' }] }).errors).toHaveLength(1);
    expect(validateBranding({ home_sections: Array.from({ length: 5 }, () => ({ title: 'X', category_id: 1 })) }).errors).toHaveLength(1);
  });

  test('categoria aceita imagem HTTPS ou data URL e recusa outros esquemas', () => {
    expect(validateCategoryInput({ nome: 'Bolsas', imagem: 'https://cdn.exemplo.com/bolsas.jpg' }).errors).toEqual([]);
    expect(validateCategoryInput({ nome: 'Bolsas', imagem: 'javascript:alert(1)' }).errors).toHaveLength(1);
  });
});
