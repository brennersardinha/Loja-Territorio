const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes');
const seoRoutes = require('./routes/seo.routes');
const { checkDatabaseConnection, pool } = require('./db');
const { metricsMiddleware, metricsHandler } = require('./monitoring/metrics');
const docsRoutes = require('./routes/docs.routes');
const { startWebhookWorker } = require('./services/webhook.service');
const { createTenantResolver, requestContextLogger } = require('./middleware/tenant');
const { createTenantRateLimiter } = require('./middleware/tenant-rate-limit');
const { buildCorsOptions } = require('./middleware/cors');
const { securityHeaders, createLoginRateLimiter } = require('./middleware/security');

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['JWT_SECRET', 'STORE_PUBLIC_URL', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'CORS_ORIGIN'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Variaveis obrigatorias ausentes: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('troque-este-segredo')) {
    throw new Error('JWT_SECRET deve ter ao menos 32 caracteres e nao pode usar o valor de exemplo');
  }
}

app.disable('x-powered-by');
const trustedProxyCidrs = (process.env.TRUSTED_PROXY_CIDRS || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
app.set('trust proxy', trustedProxyCidrs.length ? trustedProxyCidrs : false);
app.use(requestContextLogger);
app.use(securityHeaders);
app.use(metricsMiddleware);
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '20mb', verify: (req, _res, buffer) => { req.rawBody = buffer.toString('utf8'); } }));
const resolveTenantFromRequest = createTenantResolver();
const tenantRateLimit = createTenantRateLimiter();
app.use(docsRoutes);
app.use(['/robots.txt', '/sitemap.xml'], resolveTenantFromRequest, tenantRateLimit);
app.use(seoRoutes);
app.use('/api', resolveTenantFromRequest, tenantRateLimit, createLoginRateLimiter(), apiRoutes);
app.use((error, req, res, _next) => { console.error(JSON.stringify({event:'unhandled_error',request_id:req.requestId,tenant_id:req.tenant?.id||null,user_id:req.user?.id||null,message:error.message})); res.status(error.status||500).json({error:error.status?error.message:'Erro interno.'}); });

app.get('/', (req, res) => {
  res.json({ message: 'API da loja online está ativa' });
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

app.get('/health/ready', async (req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready' });
  }
});

app.get('/metrics', metricsHandler);

async function start() {
  try {
    validateProductionConfig();
    await checkDatabaseConnection();
    const stopWebhookWorker = startWebhookWorker();
    const server = app.listen(port, () => {
      console.log(`Servidor backend rodando em http://localhost:${port}`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} recebido; encerrando servidor`);
      stopWebhookWorker();
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Falha ao iniciar o servidor:', error);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = { app, start, validateProductionConfig };
