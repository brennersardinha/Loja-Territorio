const express=require('express');
const crypto=require('crypto');
const {pool}=require('../db');
const {authenticateToken,requirePermission}=require('./user.routes');
const {PERMISSIONS}=require('../config/rbac');
const {getTenantId}=require('../middleware/tenant');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function createInventoryRouter({db=pool,auth=authenticateToken,permission=requirePermission(PERMISSIONS.INVENTORY_KEYS_MANAGE)}={}){
 const router=express.Router(),admin=[auth,permission];
 router.get('/admin/inventory/api-keys',...admin,async(req,res)=>{const r=await db.query('SELECT id,name,key_prefix,active,last_used_at,created_at FROM inventory_api_keys WHERE tenant_id=$1 ORDER BY id',[getTenantId(req)]);res.json({keys:r.rows});});
 router.post('/admin/inventory/api-keys',...admin,async(req,res)=>{const tenantId=getTenantId(req),name=String(req.body?.name||'').trim();if(!name||name.length>120)return res.status(400).json({error:'Nome da chave inválido.'});const key=`inv_${crypto.randomBytes(32).toString('base64url')}`;const r=await db.query('INSERT INTO inventory_api_keys(tenant_id,name,key_prefix,key_hash) VALUES($1,$2,$3,$4) RETURNING id,name,key_prefix,active,created_at',[tenantId,name,key.slice(0,12),hash(key)]);res.status(201).json({api_key:r.rows[0],key});});
 router.patch('/admin/inventory/api-keys/:id',...admin,async(req,res)=>{if(typeof req.body?.active!=='boolean')return res.status(400).json({error:'Estado da chave inválido.'});const r=await db.query('UPDATE inventory_api_keys SET active=$1 WHERE id=$2 AND tenant_id=$3 RETURNING id,name,key_prefix,active,last_used_at,created_at',[req.body.active,Number(req.params.id),getTenantId(req)]);return r.rowCount?res.json({api_key:r.rows[0]}):res.status(404).json({error:'Chave não encontrada.'});});
 async function apiKeyFor(req,res){const raw=String(req.headers['x-api-key']||'');if(!raw){res.status(401).json({error:'X-API-Key é obrigatória.'});return null;}const keyResult=await db.query('SELECT id,tenant_id FROM inventory_api_keys WHERE key_hash=$1 AND active=true',[hash(raw)]);if(!keyResult.rowCount){res.status(401).json({error:'Chave de integração inválida.'});return null;}if(Number(keyResult.rows[0].tenant_id)!==getTenantId(req)){res.status(403).json({error:'Chave não autorizada para esta loja.'});return null;}return keyResult;}
 router.get('/integrations/inventory',async(req,res)=>{
  const keyResult=await apiKeyFor(req,res);if(!keyResult)return;
  const limit=Math.min(500,Math.max(1,Number(req.query.limit)||100)),page=Math.max(1,Number(req.query.page)||1),sku=String(req.query.sku||'').trim();
  const r=await db.query(`SELECT id,sku,nome,estoque,COUNT(*) OVER()::int AS total FROM products WHERE tenant_id=$1 AND ($2='' OR LOWER(sku)=LOWER($2)) ORDER BY id LIMIT $3 OFFSET $4`,[getTenantId(req),sku,limit,(page-1)*limit]);
  await db.query('UPDATE inventory_api_keys SET last_used_at=NOW() WHERE id=$1',[keyResult.rows[0].id]);
  res.json({items:r.rows.map(({total,...item})=>item),pagination:{page,limit,total_items:r.rows[0]?.total||0}});
 });
 router.post('/integrations/inventory/sync',async(req,res)=>{
  const tenantId=getTenantId(req),idempotency=String(req.headers['idempotency-key']||'').trim();
  if(!idempotency||idempotency.length>100)return res.status(401).json({error:'X-API-Key e Idempotency-Key são obrigatórios.'});
  const keyResult=await apiKeyFor(req,res);if(!keyResult)return;
  const items=req.body?.items,mode=req.body?.mode||'set';
  if(!Array.isArray(items)||!items.length||items.length>1000||!['set','increment'].includes(mode))return res.status(400).json({error:'Lote de estoque inválido.'});
  const normalized=items.map(x=>({id:x.id==null?null:Number(x.id),sku:x.sku==null?null:String(x.sku).trim(),quantity:Number(x.quantity)}));
  if(normalized.some(x=>(!Number.isInteger(x.id)||x.id<1)&&!x.sku)||normalized.some(x=>!Number.isInteger(x.quantity)||(mode==='set'&&x.quantity<0)))return res.status(400).json({error:'Cada item exige id ou sku e quantidade inteira válida.'});
  const requestHash=hash(JSON.stringify({mode,items:normalized})),client=await db.connect();
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${tenantId}:${keyResult.rows[0].id}:${idempotency}`]);
   const previous=await client.query('SELECT request_hash,response,status FROM inventory_sync_requests WHERE tenant_id=$1 AND api_key_id=$2 AND idempotency_key=$3 FOR UPDATE',[tenantId,keyResult.rows[0].id,idempotency]);
   if(previous.rowCount){await client.query('ROLLBACK');if(previous.rows[0].request_hash!==requestHash)return res.status(409).json({error:'Idempotency-Key reutilizada com outro conteúdo.'});return res.status(previous.rows[0].status==='completed'?200:409).json(previous.rows[0].response||{error:'Requisicao ainda em processamento.'});}
   await client.query('INSERT INTO inventory_sync_requests(tenant_id,api_key_id,idempotency_key,request_hash) VALUES($1,$2,$3,$4)',[tenantId,keyResult.rows[0].id,idempotency,requestHash]);const updated=[];
   for(const item of normalized){const r=await client.query(`UPDATE products SET estoque=CASE WHEN $1='set' THEN $2 ELSE estoque+$2 END WHERE ${item.id?'id=$3':'LOWER(sku)=LOWER($3)'} AND tenant_id=$4 AND (CASE WHEN $1='set' THEN $2 ELSE estoque+$2 END)>=0 RETURNING id,sku,estoque`,[mode,item.quantity,item.id||item.sku,tenantId]);if(!r.rowCount)throw Object.assign(new Error(`Produto não encontrado ou estoque negativo: ${item.id||item.sku}`),{status:422});updated.push(r.rows[0]);}
   const response={updated,count:updated.length};await client.query("UPDATE inventory_sync_requests SET status='completed',response=$1::jsonb,updated_at=NOW() WHERE tenant_id=$2 AND api_key_id=$3 AND idempotency_key=$4",[JSON.stringify(response),tenantId,keyResult.rows[0].id,idempotency]);await client.query('UPDATE inventory_api_keys SET last_used_at=NOW() WHERE id=$1 AND tenant_id=$2',[keyResult.rows[0].id,tenantId]);await client.query('COMMIT');res.json(response);
  }catch(e){await client.query('ROLLBACK');res.status(e.status||500).json({error:e.message||'Falha ao sincronizar estoque.'});}finally{client.release();}
 });return router;
}
module.exports={createInventoryRouter,hash};
