const express = require('express');
const request = require('supertest');
const { metricsMiddleware, metricsHandler, resetMetrics } = require('../src/monitoring/metrics');

describe('Prometheus metrics', () => {
  beforeEach(resetMetrics);

  test('records normalized HTTP counters and durations', async () => {
    const app = express();
    app.use(metricsMiddleware);
    app.get('/items/:id', (req, res) => res.status(201).json({ id: req.params.id }));
    app.get('/metrics', metricsHandler);

    await request(app).get('/items/123').expect(201);
    const response = await request(app).get('/metrics').expect(200);

    expect(response.text).toContain('ecommerce_http_requests_total{method="GET",route="/items/:id",status="201"} 1');
    expect(response.text).toContain('ecommerce_http_request_duration_seconds_count');
    expect(response.text).not.toContain('route="/items/123"');
    expect(response.text).toContain('ecommerce_process_resident_memory_bytes');
  });
});
