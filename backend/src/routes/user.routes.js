const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { ROLES, getPermissions } = require('../config/rbac');
const { ResendEmail } = require('../infrastructure/communications');

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
const SESSION_COOKIE = 'ecommerce_session';
const CSRF_COOKIE = 'ecommerce_csrf';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function cookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((result, item) => {
    const index = item.indexOf('=');
    if (index > 0) result[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    return result;
  }, {});
}

function cookieOptions(httpOnly) {
  return ['Path=/', `Max-Age=${SESSION_MAX_AGE_MS / 1000}`, 'SameSite=Strict', httpOnly ? 'HttpOnly' : '', process.env.NODE_ENV === 'production' ? 'Secure' : ''].filter(Boolean).join('; ');
}

function setSessionCookies(res, token, csrfToken) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(true)}`);
  res.append('Set-Cookie', `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${cookieOptions(false)}`);
}

function clearSessionCookies(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`);
  res.append('Set-Cookie', `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secure}`);
}

function resolveUserRole(user) {
  return user?.membership_role === 'owner' ? ROLES.ADMIN : ROLES.CUSTOMER;
}

function sanitizeUser(user, tenant) {
  const role = resolveUserRole(user);
  return {
    id: user.id, nome: user.nome, email: user.email, endereco: user.endereco,
    created_at: user.created_at, is_admin: role === ROLES.ADMIN, role,
    membership_id: user.membership_id || null,
    membership_role: user.membership_role || null,
    tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status } : null,
    permissions: getPermissions(role),
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sessão de autenticação não informada.' });
    if (!getPermissions(resolveUserRole(req.user)).includes(permission)) return res.status(403).json({ error: 'Você não possui permissão para esta ação.' });
    return next();
  };
}

async function createSession(userId, tenantId, membershipId, rotatedFrom = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  const id = crypto.randomUUID();
  await pool.query(`WITH excess AS (SELECT id FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW() ORDER BY created_at DESC OFFSET 2) UPDATE auth_sessions SET revoked_at=NOW() WHERE id IN(SELECT id FROM excess)`, [userId]);
  await pool.query(`INSERT INTO auth_sessions(id,token_hash,csrf_token_hash,user_id,tenant_id,membership_id,rotated_from,expires_at)
                    VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL '12 hours')`, [id, hash(token), hash(csrfToken), userId, tenantId, membershipId, rotatedFrom]);
  return { id, token, csrfToken };
}

function csrfValue(req) {
  const header = String(req.headers['x-csrf-token'] || '');
  if (header) return header;
  const bearer = String(req.headers.authorization || '');
  return bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
}

async function authenticateToken(req, res, next) {
  const sessionToken = cookies(req)[SESSION_COOKIE];
  try {
    if (sessionToken) {
      const result = await pool.query(`SELECT s.id session_id,s.csrf_token_hash,s.tenant_id,s.membership_id,
                                              u.id,u.nome,u.email,u.endereco,u.created_at,u.is_admin,u.role,
                                              m.role membership_role,m.status membership_status
                                       FROM auth_sessions s JOIN users u ON u.id=s.user_id
                                       JOIN memberships m ON m.id=s.membership_id AND m.user_id=s.user_id AND m.tenant_id=s.tenant_id
                                       JOIN tenants t ON t.id=s.tenant_id
                                       WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW() AND s.last_seen_at>NOW()-INTERVAL '30 minutes'
                                         AND m.status='active' AND t.status='active'`, [hash(sessionToken)]);
      if (!result.rowCount) {
        clearSessionCookies(res);
        return res.status(401).json({ error: 'Sessão inválida, revogada ou sem acesso a esta loja.' });
      }
      if (req.tenant && Number(result.rows[0].tenant_id) !== Number(req.tenant.id)) return res.status(403).json({ error: 'Sessão não autorizada para esta loja.' });
      const user = result.rows[0];
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && hash(csrfValue(req)) !== user.csrf_token_hash) return res.status(403).json({ error: 'Token CSRF inválido.' });
      user.role = resolveUserRole(user);
      req.user = user;
      req.membership = { id: user.membership_id, role: user.membership_role, status: user.membership_status };
      req.session = { id: user.session_id };
      await pool.query('UPDATE auth_sessions SET last_seen_at=NOW() WHERE id=$1', [user.session_id]);
      return next();
    }
    const bearer = String(req.headers.authorization || '');
    if (!bearer.startsWith('Bearer ')) return res.status(401).json({ error: 'Sessão de autenticação não informada.' });
    const payload = jwt.verify(bearer.slice(7), jwtSecret);
    const tenantId = req.tenant?.id || null;
    const result = await pool.query(`SELECT u.id,u.nome,u.email,u.endereco,u.created_at,u.is_admin,u.role,
                                            m.id membership_id,m.role membership_role,m.status membership_status
                                     FROM users u LEFT JOIN memberships m ON m.user_id=u.id AND m.tenant_id=$2 WHERE u.id=$1`, [payload.sub, tenantId]);
    if (!result.rowCount || (tenantId && result.rows[0].membership_status !== 'active')) return res.status(401).json({ error: 'Usuário sem membership ativa nesta loja.' });
    result.rows[0].role = resolveUserRole(result.rows[0]);
    req.user = result.rows[0];
    req.membership = result.rows[0].membership_id ? { id: result.rows[0].membership_id, role: result.rows[0].membership_role, status: result.rows[0].membership_status } : null;
    return next();
  } catch (error) { return res.status(401).json({ error: 'Sessão inválida ou expirada.' }); }
}

function validateAuthInput({ nome, email, senha }, requireName = false) {
  const errors = [];
  if (requireName && (!nome || nome.trim().length < 2)) errors.push('Nome deve ter pelo menos 2 caracteres.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email inválido.');
  if (!senha || senha.length < 6) errors.push('Senha deve ter pelo menos 6 caracteres.');
  return errors;
}

router.post('/register', async (req, res) => {
  if (!req.tenant) return res.status(400).json({ error: 'Contexto de loja ausente.' });
  const { nome = '', email = '', senha = '' } = req.body;
  const errors = validateAuthInput({ nome, email, senha }, true);
  if (errors.length) return res.status(400).json({ errors });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(`INSERT INTO users(nome,email,senha_hash) VALUES($1,$2,$3)
                                           RETURNING id,nome,email,endereco,created_at,is_admin,role`, [nome.trim(), email.trim().toLowerCase(), await bcrypt.hash(senha, 10)]);
    const membership = await client.query(`INSERT INTO memberships(user_id,tenant_id,role,status,accepted_at)
                                            VALUES($1,$2,'customer','active',NOW()) RETURNING id,role`, [userResult.rows[0].id, req.tenant.id]);
    await client.query('COMMIT');
    const session = await createSession(userResult.rows[0].id, req.tenant.id, membership.rows[0].id);
    setSessionCookies(res, session.token, session.csrfToken);
    return res.status(201).json({ user: sanitizeUser({ ...userResult.rows[0], membership_id: membership.rows[0].id, membership_role: membership.rows[0].role }, req.tenant), csrf_token: session.csrfToken });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Email já cadastrado.' : 'Erro interno ao cadastrar usuário.' });
  } finally { client.release(); }
});

router.post('/login', async (req, res) => {
  if (!req.tenant) return res.status(400).json({ error: 'Contexto de loja ausente.' });
  const { email = '', senha = '' } = req.body;
  const errors = validateAuthInput({ email, senha });
  if (errors.length) return res.status(400).json({ errors });
  try {
    const result = await pool.query(`SELECT u.id,u.nome,u.email,u.senha_hash,u.endereco,u.created_at,u.is_admin,u.role,
                                            m.id membership_id,m.role membership_role,m.status membership_status
                                     FROM users u JOIN memberships m ON m.user_id=u.id AND m.tenant_id=$2 WHERE u.email=$1`, [email.trim().toLowerCase(), req.tenant.id]);
    if (!result.rowCount || result.rows[0].membership_status !== 'active' || !await bcrypt.compare(senha, result.rows[0].senha_hash)) return res.status(401).json({ error: 'Email, senha ou acesso a loja inválidos.' });
    const session = await createSession(result.rows[0].id, req.tenant.id, result.rows[0].membership_id);
    setSessionCookies(res, session.token, session.csrfToken);
    return res.json({ user: sanitizeUser(result.rows[0], req.tenant), csrf_token: session.csrfToken });
  } catch (error) { return res.status(500).json({ error: 'Erro interno ao fazer login.' }); }
});

router.post('/password/forgot', async (req, res) => {
  const accepted = { message: 'Se houver uma conta ativa nesta loja, as instruções serão enviadas por e-mail.' };
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!req.tenant || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(202).json(accepted);
  try {
    const result = await pool.query(`SELECT u.id,u.email FROM users u JOIN memberships m ON m.user_id=u.id AND m.tenant_id=$2 WHERE u.email=$1 AND m.status='active'`, [email, req.tenant.id]);
    const user = result.rows[0];
    if (!user) return res.status(202).json(accepted);
    const token = crypto.randomBytes(32).toString('base64url'), id = crypto.randomUUID();
    await pool.query('UPDATE tenant_password_resets SET revoked_at=NOW() WHERE user_id=$1 AND tenant_id=$2 AND consumed_at IS NULL AND revoked_at IS NULL', [user.id, req.tenant.id]);
    await pool.query(`INSERT INTO tenant_password_resets(id,user_id,tenant_id,token_hash,expires_at,requested_ip_hash) VALUES($1,$2,$3,$4,NOW()+INTERVAL '30 minutes',$5)`, [id, user.id, req.tenant.id, hash(token), hash(req.ip || '')]);
    const storeUrl = (process.env.STORE_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${storeUrl}/conta?reset_token=${encodeURIComponent(token)}`;
    try {
      await new ResendEmail().send({ to: user.email, subject: `Redefinição de senha — ${req.tenant.name}`, text: `Use este link em até 30 minutos para redefinir sua senha: ${resetUrl}`, html: `<p>Recebemos uma solicitação para redefinir sua senha em <strong>${String(req.tenant.name).replace(/[<>&"']/g, '')}</strong>.</p><p><a href="${resetUrl}">Redefinir senha</a></p><p>O link expira em 30 minutos e só pode ser usado uma vez.</p>` });
      await pool.query(`INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,request_id,metadata,outcome,ip_address) VALUES($1,$2,'tenant.password_reset.requested','tenant_security',$3,$4,'{}','success',$5)`, [req.tenant.id, user.id, String(user.id), req.requestId || null, req.ip || null]);
    } catch {
      await pool.query('UPDATE tenant_password_resets SET revoked_at=NOW() WHERE id=$1', [id]);
      await pool.query(`INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,request_id,metadata,outcome,ip_address) VALUES($1,$2,'tenant.password_reset.delivery_failed','tenant_security',$3,$4,'{}','failure',$5)`, [req.tenant.id, user.id, String(user.id), req.requestId || null, req.ip || null]).catch(() => {});
    }
    return res.status(202).json(accepted);
  } catch { return res.status(202).json(accepted); }
});

router.post('/password/reset', async (req, res) => {
  const token = String(req.body?.token || ''), password = String(req.body?.senha || '');
  if (!req.tenant || token.length < 32 || password.length < 12) return res.status(400).json({ error: 'Link válido e senha de no mínimo 12 caracteres são obrigatórios.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT id,user_id FROM tenant_password_resets WHERE token_hash=$1 AND tenant_id=$2 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE`, [hash(token), req.tenant.id]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Link de redefinição inválido ou expirado.' }); }
    const reset = result.rows[0];
    await client.query('UPDATE users SET senha_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 12), reset.user_id]);
    await client.query('UPDATE tenant_password_resets SET consumed_at=NOW() WHERE id=$1', [reset.id]);
    await client.query('UPDATE tenant_password_resets SET revoked_at=NOW() WHERE user_id=$1 AND id<>$2 AND consumed_at IS NULL AND revoked_at IS NULL', [reset.user_id, reset.id]);
    await client.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL', [reset.user_id]);
    await client.query(`INSERT INTO audit_logs(tenant_id,user_id,action,entity_type,entity_id,request_id,metadata,outcome,ip_address) VALUES($1,$2,'tenant.password_reset.completed','tenant_security',$3,$4,'{}','success',$5)`, [req.tenant.id, reset.user_id, String(reset.user_id), req.requestId || null, req.ip || null]);
    await client.query('COMMIT'); clearSessionCookies(res);
    return res.json({ message: 'Senha redefinida. Entre novamente com a nova senha.' });
  } catch { await client.query('ROLLBACK'); return res.status(500).json({ error: 'Não foi possível redefinir a senha.' }); } finally { client.release(); }
});

router.post('/logout', authenticateToken, async (req, res) => {
  if (req.session) await pool.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1', [req.session.id]);
  clearSessionCookies(res);
  return res.json({ message: 'Logout realizado.' });
});

router.post('/session/rotate', authenticateToken, async (req, res) => {
  if (!req.session || !req.membership) return res.status(400).json({ error: 'Sessão legada não pode ser rotacionada.' });
  await pool.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1', [req.session.id]);
  const session = await createSession(req.user.id, req.tenant.id, req.membership.id, req.session.id);
  setSessionCookies(res, session.token, session.csrfToken);
  return res.json({ csrf_token: session.csrfToken });
});

router.get('/profile', authenticateToken, (req, res) => res.json({ user: sanitizeUser(req.user, req.tenant) }));
router.put('/profile', authenticateToken, async (req, res) => {
  const { nome = '', email = '', endereco = '' } = req.body;
  const errors = [];
  if (nome.trim().length < 2) errors.push('Nome deve ter pelo menos 2 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email inválido.');
  if (errors.length) return res.status(400).json({ errors });
  try {
    const result = await pool.query(`UPDATE users SET nome=$1,email=$2,endereco=$3 WHERE id=$4 RETURNING id,nome,email,endereco,created_at,is_admin,role`, [nome.trim(), email.trim().toLowerCase(), endereco.trim() || null, req.user.id]);
    return res.json({ user: sanitizeUser({ ...result.rows[0], membership_id: req.membership?.id, membership_role: req.membership?.role }, req.tenant) });
  } catch (error) { return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Email já cadastrado.' : 'Erro interno ao atualizar perfil.' }); }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requirePermission = requirePermission;
module.exports.resolveUserRole = resolveUserRole;
module.exports.createSession = createSession;
