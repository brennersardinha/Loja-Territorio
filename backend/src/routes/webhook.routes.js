const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticateToken, requirePermission } = require('./user.routes');
const { PERMISSIONS } = require('../config/rbac');
const { SUPPORTED_EVENTS, validateWebhookUrl } = require('../services/webhook.service');
const { getTenantId } = require('../middleware/tenant');

function normalizeEvents(events) {
  if (!Array.isArray(events)) return null;
  const unique = [...new Set(events)];
  return unique.length && unique.every((event) => SUPPORTED_EVENTS.includes(event)) ? unique : null;
}

function createWebhookRouter({ db = pool, auth = authenticateToken, permission = requirePermission(PERMISSIONS.WEBHOOKS_MANAGE) } = {}) {
  const router = express.Router();
  const admin = [auth, permission];
  router.get('/admin/webhooks/events', ...admin, (_req, res) => res.json({ events: SUPPORTED_EVENTS }));
  router.get('/admin/webhooks', ...admin, async (req, res) => { const tenantId=getTenantId(req);const r = await db.query(`SELECT id,url,description,events,active,created_at,updated_at,CONCAT(SUBSTRING(secret,1,4),'...',RIGHT(secret,4)) secret_hint FROM webhook_endpoints WHERE tenant_id=$1 ORDER BY id`,[tenantId]); res.json({ endpoints: r.rows }); });
  router.post('/admin/webhooks', ...admin, async (req, res) => {
    const url=String(req.body?.url||'').trim(), description=String(req.body?.description||'').trim(), events=normalizeEvents(req.body?.events);
    if(!validateWebhookUrl(url)||!events||description.length>180)return res.status(400).json({error:'URL, descricao ou eventos invalidos.'});
    const tenantId=getTenantId(req);const secret=crypto.randomBytes(32).toString('hex'); const r=await db.query(`INSERT INTO webhook_endpoints(tenant_id,url,description,events,secret,active) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING id,url,description,events,active,created_at,updated_at`,[tenantId,url,description||null,JSON.stringify(events),secret,req.body?.active!==false]);
    res.status(201).json({endpoint:r.rows[0],secret});
  });
  router.put('/admin/webhooks/:id', ...admin, async(req,res)=>{const tenantId=getTenantId(req),id=Number(req.params.id),url=String(req.body?.url||'').trim(),description=String(req.body?.description||'').trim(),events=normalizeEvents(req.body?.events);if(!Number.isInteger(id)||id<1||!validateWebhookUrl(url)||!events||description.length>180)return res.status(400).json({error:'Dados do webhook invalidos.'});const r=await db.query(`UPDATE webhook_endpoints SET url=$1,description=$2,events=$3::jsonb,active=$4,updated_at=NOW() WHERE id=$5 AND tenant_id=$6 RETURNING id,url,description,events,active,created_at,updated_at`,[url,description||null,JSON.stringify(events),req.body?.active!==false,id,tenantId]);return r.rowCount?res.json({endpoint:r.rows[0]}):res.status(404).json({error:'Webhook nao encontrado.'});});
  router.post('/admin/webhooks/:id/rotate-secret',...admin,async(req,res)=>{const tenantId=getTenantId(req),secret=crypto.randomBytes(32).toString('hex');const r=await db.query('UPDATE webhook_endpoints SET secret=$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id',[secret,Number(req.params.id),tenantId]);return r.rowCount?res.json({id:r.rows[0].id,secret}):res.status(404).json({error:'Webhook nao encontrado.'});});
  router.delete('/admin/webhooks/:id',...admin,async(req,res)=>{const r=await db.query('DELETE FROM webhook_endpoints WHERE id=$1 AND tenant_id=$2 RETURNING id',[Number(req.params.id),getTenantId(req)]);return r.rowCount?res.status(204).send():res.status(404).json({error:'Webhook nao encontrado.'});});
  router.get('/admin/webhooks/:id/deliveries',...admin,async(req,res)=>{const limit=Math.min(100,Math.max(1,Number(req.query.limit)||25));const r=await db.query(`SELECT id,event_id,event_type,status,attempts,response_status,response_body,last_error,next_attempt_at,delivered_at,created_at,updated_at FROM webhook_deliveries WHERE endpoint_id=$1 AND tenant_id=$2 ORDER BY id DESC LIMIT $3`,[Number(req.params.id),getTenantId(req),limit]);res.json({deliveries:r.rows});});
  router.post('/admin/webhooks/:id/test',...admin,async(req,res)=>{const tenantId=getTenantId(req),endpoint=await db.query('SELECT id FROM webhook_endpoints WHERE id=$1 AND tenant_id=$2 AND active=true',[Number(req.params.id),tenantId]);if(!endpoint.rowCount)return res.status(404).json({error:'Webhook ativo nao encontrado.'});const eventId=crypto.randomUUID(),payload={id:eventId,type:'order.created',created_at:new Date().toISOString(),data:{test:true,endpoint_id:endpoint.rows[0].id}};await db.query('INSERT INTO webhook_deliveries(tenant_id,endpoint_id,event_id,event_type,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING',[tenantId,endpoint.rows[0].id,eventId,'order.created',JSON.stringify(payload)]);res.status(202).json({message:'Entrega de teste enfileirada.',event_id:eventId});});
  router.post('/admin/webhook-deliveries/:id/retry',...admin,async(req,res)=>{const r=await db.query(`UPDATE webhook_deliveries SET status='pending',attempts=0,next_attempt_at=NOW(),last_error=NULL,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status='failed' RETURNING id`,[Number(req.params.id),getTenantId(req)]);return r.rowCount?res.status(202).json({message:'Entrega reenfileirada.'}):res.status(409).json({error:'Somente entregas com falha podem ser reenfileiradas.'});});
  return router;
}
module.exports={createWebhookRouter,normalizeEvents};
