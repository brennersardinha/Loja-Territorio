const express = require('express');
const request = require('supertest');

jest.mock('../src/db', () => ({ pool: { query: jest.fn() } }));

const productRoutes = require('../src/routes/product.routes');
const categoryRoutes = require('../src/routes/category.routes');

const app = express();
app.use(express.json());
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);

describe('catalog write security', () => {
  test.each([
    ['post', '/api/products'],
    ['put', '/api/products/1'],
    ['delete', '/api/products/1'],
    ['post', '/api/categories'],
    ['put', '/api/categories/1'],
    ['delete', '/api/categories/1'],
  ])('%s %s rejects unauthenticated writes', async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
  });
});
