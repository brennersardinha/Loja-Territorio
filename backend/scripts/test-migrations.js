// Aplica as migrations em um banco temporario vazio e valida o schema da loja unica.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { enqueueWebhookEvent } = require('../src/services/webhook.service');

const databaseName = `loja_migration_${process.pid}_${Date.now()}`;
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};
const adminPool = new Pool({ ...baseConfig, database: 'postgres' });
const expectedMigrationCount = fs.readdirSync(path.join(__dirname, '..', 'src', 'migrations'))
  .filter((name) => /^\d{3}_[a-z0-9_]+\.js$/.test(name)).length;
const expectedTables = [
  'addresses', 'audit_logs', 'auth_sessions', 'cart_items', 'carts', 'categories', 'checkout_sessions', 'coupons',
  'integration_settings', 'inventory_api_keys', 'inventory_sync_requests', 'memberships', 'notifications', 'order_items',
  'order_status_history', 'orders', 'product_reviews', 'products', 'schema_migrations', 'shipping_quotes', 'shipping_tracking',
  'store_settings', 'tenant_branding', 'tenant_marketing_settings', 'tenant_password_resets', 'tenants', 'users',
  'webhook_deliveries', 'webhook_endpoints', 'wishlist_items',
];

function quotedIdentifier(value) {
  if (!/^loja_migration_\d+_\d+$/.test(value)) throw new Error('Nome de banco temporario invalido');
  return `"${value}"`;
}

function runMigrations(command = 'up') {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'migrate.js'), command], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...baseConfig, DB_PORT: String(baseConfig.port), DB_DATABASE: databaseName, DB_POOL_MAX: '1' },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`Migrations falharam (${command})`);
}

async function expectError(code, callback, label) {
  try { await callback(); } catch (error) { if (error.code === code) return; throw error; }
  throw new Error(`Operacao aceita indevidamente: ${label}`);
}

async function validateSchema() {
  const pool = new Pool({ ...baseConfig, database: databaseName });
  try {
    const migrations = await pool.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
    if (migrations.rows[0].count !== expectedMigrationCount) throw new Error('Nem todas as migrations foram registradas');

    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    const actual = tables.rows.map((row) => row.tablename);
    if (JSON.stringify(actual) !== JSON.stringify([...expectedTables].sort())) throw new Error(`Tabelas inesperadas: ${actual.join(', ')}`);

    const store = await pool.query("SELECT id, status, default_currency FROM tenants WHERE slug='default'");
    if (store.rowCount !== 1 || store.rows[0].id !== 1 || store.rows[0].status !== 'active') throw new Error('Loja padrao nao foi criada com id 1');
    const settings = await pool.query('SELECT COUNT(*)::int AS count FROM store_settings WHERE tenant_id=1');
    if (settings.rows[0].count !== 3) throw new Error('Configuracoes padrao da loja ausentes');

    await expectError('23514', () => pool.query("INSERT INTO tenants(name, slug, status) VALUES('Outra', 'outra', 'suspended')"), 'status de loja inexistente');
    const user = await pool.query("INSERT INTO users(nome, email, senha_hash) VALUES('Teste', 'teste@example.test', 'hash') RETURNING id");
    await expectError('23514', () => pool.query("INSERT INTO memberships(user_id, tenant_id, role) VALUES($1, 1, 'manager')", [user.rows[0].id]), 'papel de equipe');

    const checkout = await pool.query("INSERT INTO checkout_sessions(usuario_id, shipping_method, payment_method, expires_at) VALUES($1, 'standard', 'pix', NOW()+INTERVAL '1 hour') RETURNING id", [user.rows[0].id]);
    const order = await pool.query("INSERT INTO orders(usuario_id, checkout_session_id, shipping_method, payment_method, total) VALUES($1, $2, 'standard', 'pix', 10) RETURNING id, tenant_id", [user.rows[0].id, checkout.rows[0].id]);
    if (order.rows[0].tenant_id !== 1) throw new Error('tenant_id padrao nao aplicado');
    await expectError('23514', () => pool.query('UPDATE orders SET total=total+1 WHERE id=$1', [order.rows[0].id]), 'alteracao do total do pedido');
    await pool.query("UPDATE orders SET status='processing' WHERE id=$1", [order.rows[0].id]);

    // Executa a consulta real do outbox: erros de tipagem do Postgres so aparecem contra o banco.
    await pool.query("INSERT INTO webhook_endpoints(url, secret, events) VALUES('https://example.test/hook', 'segredo', '[\"order.created\"]'::jsonb)");
    await enqueueWebhookEvent(pool, 1, 'order.created', { order: { id: order.rows[0].id } });
    const deliveries = await pool.query("SELECT COUNT(*)::int AS count FROM webhook_deliveries WHERE event_type='order.created'");
    if (deliveries.rows[0].count !== 1) throw new Error('Webhook order.created nao foi enfileirado');
  } finally {
    await pool.end();
  }
}

async function main() {
  await adminPool.query(`CREATE DATABASE ${quotedIdentifier(databaseName)}`);
  try {
    runMigrations();
    runMigrations();
    await validateSchema();
    console.log('Migrations validadas em banco vazio.');
  } finally {
    await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [databaseName]);
    await adminPool.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(databaseName)}`);
    await adminPool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
