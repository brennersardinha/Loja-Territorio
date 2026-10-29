const express = require('express');
const request = require('supertest');
const { createBrandingRouter, contrastRatio, validateBranding } = require('../src/routes/branding.routes');

const auth = (req, res, next) => { req.user = { role: req.get('x-role') || 'admin' }; next(); };
function appWith(db) { const app = express(); app.use(express.json({ limit: '20mb' })); app.use((req,res,next)=>{req.tenant={id:7,slug:'loja-sete',status:'active'};next()}); app.use('/api', createBrandingRouter({ pool: db, authenticateToken: auth })); return app; }

describe('Branding da loja', () => {
  test('rejeita tema inseguro ou fora dos limites', () => {
    const result = validateBranding({ store_name: 'Loja', logo: 'javascript:alert(1)', colors: { primary: 'red' }, font: 'Comic Sans', border_radius: 99 });
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
  test('usa a paleta oficial e valida contraste antes da publicacao', () => {
    const valid = validateBranding({ store_name: 'Loja', colors: { primary: '#3b82f6', secondary: '#1f2937', background: '#f8f9fa' } });
    expect(valid.errors).toEqual([]);
    expect(valid.value.colors).toEqual({ primary: '#3b82f6', secondary: '#1f2937', background: '#f8f9fa' });
    expect(contrastRatio(valid.value.colors.secondary, valid.value.colors.background)).toBeGreaterThanOrEqual(4.5);

    const invalid = validateBranding({ store_name: 'Loja', colors: { primary: '#ffffff', secondary: '#f3f4f6', background: '#ffffff' } });
    expect(invalid.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('texto e fundo'),
      expect.stringContaining('cor de acao e fundo'),
    ]));
  });
  test('retorna a identidade visual da loja', async () => {
    const db = { query: jest.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ tenant_id: 7, branding: { store_name: 'Loja Sete' } }] }) };
    const response = await request(appWith(db)).get('/api/branding');
    expect(response.status).toBe(200); expect(response.body.branding.store_name).toBe('Loja Sete'); expect(db.query.mock.calls[0][1][0]).toBe(7);
  });
  test('protege a publicacao com RBAC', async () => {
    const response = await request(appWith({})).put('/api/admin/branding').set('x-role', 'customer').send({ branding: {} });
    expect(response.status).toBe(403);
  });
});
