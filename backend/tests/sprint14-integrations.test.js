const express=require('express');
const request=require('supertest');
const {createPayment,verifyPayment}=require('../src/services/payment.service');
const {createIntegrationRouter,validSettings}=require('../src/routes/integration.routes');
const {createInventoryRouter,hash}=require('../src/routes/inventory.routes');
const pass=(req,_res,next)=>{req.user={id:1,email:'buyer@example.com',role:'admin'};req.tenant={id:7,slug:'teste'};next();};

describe('Abstracao de pagamentos',()=>{
 test('provedor sandbox cria e confirma pagamentos pelo mesmo contrato',async()=>{const created=await createPayment({provider:'sandbox',sessionId:12,method:'pix'});expect(created.external_id).toBe('SANDBOX-12');await expect(verifyPayment({provider:'sandbox',externalId:created.external_id})).resolves.toMatchObject({confirmed:true,reference:'SANDBOX-12'});});
 test('configuração aceita somente referências a variaveis de ambiente para segredos',()=>{expect(validSettings({secret_key_env:'STRIPE_SECRET_KEY',api_url:'https://api.stripe.com'})).toBe(true);expect(validSettings({secret_key:'sk_live_exposto'})).toBe(false);});
 test('cadastra gateway ativo por API administrativa',async()=>{const db={query:jest.fn().mockResolvedValue({rowCount:1,rows:[{provider:'stripe',kind:'payment',active:true}]})};const app=express();app.use(express.json(),createIntegrationRouter({db,auth:pass,permission:()=>pass}));const response=await request(app).put('/admin/integrations/payment/stripe').send({settings:{secret_key_env:'STRIPE_SECRET_KEY'},active:true});expect(response.status).toBe(200);expect(db.query.mock.calls[0][1].slice(0,2)).toEqual([7,'stripe']);});
});

describe('Sincronização de estoque',()=>{
 test('hash de chave não expoe a credencial original',()=>{expect(hash('inv_secret')).toMatch(/^[a-f0-9]{64}$/);expect(hash('inv_secret')).not.toContain('inv_secret');});
 test('rejeita lote sem chave antes de acessar banco',async()=>{const db={query:jest.fn()};const app=express();app.use(express.json(),pass,createInventoryRouter({db,auth:pass,permission:pass}));const response=await request(app).post('/integrations/inventory/sync').send({items:[{id:1,quantity:2}]});expect(response.status).toBe(401);expect(db.query).not.toHaveBeenCalled();});
 test('emite chave no tenant mostrando o segredo apenas na criação',async()=>{const db={query:jest.fn().mockResolvedValue({rowCount:1,rows:[{id:1,name:'ERP',key_prefix:'inv_abc',active:true}]})};const app=express();app.use(express.json(),createInventoryRouter({db,auth:pass,permission:pass}));const response=await request(app).post('/admin/inventory/api-keys').send({name:'ERP'});expect(response.status).toBe(201);expect(response.body.key).toMatch(/^inv_/);expect(db.query.mock.calls[0][1][0]).toBe(7);expect(db.query.mock.calls[0][1][3]).toMatch(/^[a-f0-9]{64}$/);});
 test('bloqueia chave válida pertencente a outra loja',async()=>{const db={query:jest.fn().mockResolvedValue({rowCount:1,rows:[{id:2,tenant_id:8}]})};const app=express();app.use(express.json(),pass,createInventoryRouter({db,auth:pass,permission:pass}));const response=await request(app).post('/integrations/inventory/sync').set('X-API-Key','inv_other').set('Idempotency-Key','request-1').send({items:[{id:1,quantity:2}]});expect(response.status).toBe(403);expect(db.connect).toBeUndefined();});
});
