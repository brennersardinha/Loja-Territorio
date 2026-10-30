const express = require('express');
const request = require('supertest');
const { createWebhookRouter, normalizeEvents } = require('../src/routes/webhook.routes');
const { signPayload, validateWebhookUrl, enqueueWebhookEvent } = require('../src/services/webhook.service');

const pass = (req, _res, next) => { req.user = { role: 'admin' }; req.tenant = { id: 7, slug: 'teste' }; next(); };
function app(db) { const instance=express();instance.use(express.json());instance.use('/api',createWebhookRouter({db,auth:pass,permission:pass}));return instance; }

describe('Sistema de webhooks',()=>{
  test('válida eventos sem duplicatas e rejeita eventos desconhecidos',()=>{expect(normalizeEvents(['order.created','order.created'])).toEqual(['order.created']);expect(normalizeEvents(['unknown'])).toBeNull();});
  test('aceita HTTPS público e bloqueia credenciais e redes privadas',()=>{expect(validateWebhookUrl('https://hooks.example.com/orders')).toBe(true);expect(validateWebhookUrl('https://user:pass@example.com')).toBe(false);expect(validateWebhookUrl('https://127.0.0.1/hook')).toBe(false);});
  test('gera assinatura HMAC deterministica',()=>{expect(signPayload('secret','123','{}')).toBe(signPayload('secret','123','{}'));expect(signPayload('other','123','{}')).not.toBe(signPayload('secret','123','{}'));});
  test('cria endpoint no tenant e revela o segredo somente na criação',async()=>{const db={query:jest.fn().mockResolvedValue({rowCount:1,rows:[{id:1,url:'https://hooks.example.com/orders',events:['order.created'],active:true}]})};const response=await request(app(db)).post('/api/admin/webhooks').send({url:'https://hooks.example.com/orders',events:['order.created']});expect(response.status).toBe(201);expect(response.body.secret).toMatch(/^[a-f0-9]{64}$/);expect(db.query.mock.calls[0][1].slice(0,4)).toEqual([7,'https://hooks.example.com/orders',null,'["order.created"]']);});
  test('rejeita endpoint inseguro antes de acessar o banco',async()=>{const db={query:jest.fn()};const response=await request(app(db)).post('/api/admin/webhooks').send({url:'http://127.0.0.1/internal',events:['order.created']});expect(response.status).toBe(400);expect(db.query).not.toHaveBeenCalled();});
  test('enfileira evento no outbox com id único',async()=>{const db={query:jest.fn().mockResolvedValue({rowCount:1,rows:[]})};const payload=await enqueueWebhookEvent(db,7,'payment.confirmed',{payment:{order_id:3}});expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);expect(db.query.mock.calls[0][0]).toContain('webhook_deliveries');expect(db.query.mock.calls[0][1].slice(1,4)).toEqual(['payment.confirmed',expect.any(String),7]);});
  test('teste de endpoint cria entrega somente para o tenant e destino solicitados',async()=>{const db={query:jest.fn().mockResolvedValueOnce({rowCount:1,rows:[{id:7}]}).mockResolvedValueOnce({rowCount:1,rows:[]})};const response=await request(app(db)).post('/api/admin/webhooks/7/test');expect(response.status).toBe(202);expect(db.query.mock.calls[0][1]).toEqual([7,7]);expect(db.query.mock.calls[1][1].slice(0,2)).toEqual([7,7]);});
  test('reenfileira somente entrega falha do tenant atual',async()=>{const db={query:jest.fn().mockResolvedValue({rowCount:1,rows:[{id:9}]})};const response=await request(app(db)).post('/api/admin/webhook-deliveries/9/retry');expect(response.status).toBe(202);expect(db.query.mock.calls[0][1]).toEqual([9,7]);expect(db.query.mock.calls[0][0]).toContain("status='failed'");});
});
