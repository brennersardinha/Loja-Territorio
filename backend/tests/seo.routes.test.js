const request = require('supertest');
const express = require('express');

jest.mock('../src/db', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../src/db');
const seoRoutes = require('../src/routes/seo.routes');

function createApp() {
  const app = express();
  app.use((req, res, next) => { req.tenant = { id: 1, slug: 'default', status: 'active' }; next(); });
  app.use(seoRoutes);
  return app;
}

describe('SEO routes', () => {
  const previousUrl = process.env.STORE_PUBLIC_URL;
  beforeEach(() => { jest.clearAllMocks(); delete process.env.STORE_PUBLIC_URL; });
  afterAll(() => { if (previousUrl === undefined) delete process.env.STORE_PUBLIC_URL; else process.env.STORE_PUBLIC_URL = previousUrl; });

  test('returns a robots file with the sitemap address', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rules: ['/admin', '/checkout'] }] });
    const response = await request(createApp()).get('/robots.txt').set('Host', 'loja.example.com');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Sitemap: http://loja.example.com/sitemap.xml');
    expect(response.text).toContain('Disallow: /admin');
    expect(pool.query.mock.calls[0][1]).toEqual([1]);
  });

  test('generates a sitemap with friendly product URLs', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 12, nome: 'Camiseta Azul', created_at: '2026-08-01T10:00:00.000Z' }] });
    const response = await request(createApp()).get('/sitemap.xml').set('Host', 'loja.example.com');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('max-age=3600');
    expect(response.text).toContain('http://loja.example.com/produto/12/camiseta-azul');
    expect(pool.query.mock.calls[0][1]).toEqual([1]);
  });

  test('usa STORE_PUBLIC_URL e ignora o Host enviado pelo cliente', async () => {
    process.env.STORE_PUBLIC_URL = 'https://minhaloja.com.br/';
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3, nome: 'Bolsa', slug: 'bolsa', created_at: '2026-08-01' }] });
    const response = await request(createApp()).get('/sitemap.xml').set('Host', 'atacante.example');
    expect(response.text).toContain('https://minhaloja.com.br/produto/3/bolsa');
    expect(response.text).not.toContain('atacante.example');
  });

  test('escapa conteudo dinamico no XML', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 5, nome: 'Item', slug: 'termos&condicoes', created_at: '2026-08-01' }] });
    const response = await request(createApp()).get('/sitemap.xml').set('Host', 'loja.example.com');
    expect(response.text).toContain('termos&amp;condicoes');
  });
});
