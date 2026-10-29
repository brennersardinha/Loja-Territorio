const express = require('express');
const request = require('supertest');
const cors = require('cors');
const { createTenantRateLimiter } = require('../src/middleware/tenant-rate-limit');
const { buildCorsOptions } = require('../src/middleware/cors');

describe('controles HTTP', () => {
  test('CORS aceita origem configurada e omite header para origem nao autorizada', async () => {
    const app = express();
    app.use(cors(buildCorsOptions('https://alpha.example,https://beta.example','production')));
    app.get('/',(_req,res)=>res.send('ok'));
    const allowed = await request(app).get('/').set('Origin','https://alpha.example');
    const denied = await request(app).get('/').set('Origin','https://evil.example');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://alpha.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('rate limiting mantém contadores independentes por IP', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use((req,_res,next)=>{req.tenant={id:1};next();});
    app.use(createTenantRateLimiter({max:1,windowMs:60000,now:()=>1000}));
    app.get('/',(_req,res)=>res.send('ok'));
    expect((await request(app).get('/').set('X-Forwarded-For','203.0.113.1')).status).toBe(200);
    expect((await request(app).get('/').set('X-Forwarded-For','203.0.113.1')).status).toBe(429);
    expect((await request(app).get('/').set('X-Forwarded-For','203.0.113.2')).status).toBe(200);
  });
});
