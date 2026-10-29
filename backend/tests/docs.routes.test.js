const express = require('express');
const request = require('supertest');
const docsRoutes = require('../src/routes/docs.routes');

const app = express();
app.use(docsRoutes);

describe('API documentation', () => {
  test('publishes a valid OpenAPI contract with all registered operations', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.paths['/checkout/start'].post).toBeDefined();
    expect(response.body.paths['/admin/orders/{id}/status'].put.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.values(response.body.paths).reduce((total, path) => total + Object.keys(path).length, 0)).toBeGreaterThanOrEqual(50);
  });

  test('serves Swagger UI from the API namespace', async () => {
    const response = await request(app).get('/api/docs/').expect(200);
    expect(response.text).toContain('id="swagger-ui"');
    expect(response.text).toContain('Loja Online API');
  });
});
