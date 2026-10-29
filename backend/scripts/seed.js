// Dados basicos da loja: nome, identidade visual, administrador e integracoes (inativas).
// Idempotente: pode ser executado novamente sem duplicar registros.
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { DEFAULT_BRANDING } = require('../src/routes/branding.routes');

const STORE_ID = 1;

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Defina ${name} antes de executar o seed.`);
  return value;
}

async function seedStore(client, storeName) {
  await client.query('UPDATE tenants SET name=$1, updated_at=NOW() WHERE id=$2', [storeName, STORE_ID]);
  await client.query(
    `INSERT INTO tenant_branding (tenant_id, settings) VALUES ($1, $2::jsonb)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [STORE_ID, JSON.stringify({ ...DEFAULT_BRANDING, store_name: storeName })],
  );
}

async function seedAdmin(client) {
  const email = requiredEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const password = requiredEnv('SEED_ADMIN_PASSWORD');
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD deve ter ao menos 12 caracteres.');
  const name = String(process.env.SEED_ADMIN_NAME || 'Administrador').trim();
  const user = await client.query(
    `INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET nome=EXCLUDED.nome
     RETURNING id`,
    [name, email, await bcrypt.hash(password, 12)],
  );
  await client.query(
    `INSERT INTO memberships (user_id, tenant_id, role, status, accepted_at) VALUES ($1, $2, 'owner', 'active', NOW())
     ON CONFLICT (user_id, tenant_id) DO UPDATE SET role='owner', status='active', updated_at=NOW()`,
    [user.rows[0].id, STORE_ID],
  );
  return email;
}

async function seedIntegrations(client) {
  // Credenciais ficam somente em variaveis de ambiente; o banco guarda apenas o nome da variavel.
  await client.query(
    `INSERT INTO integration_settings (tenant_id, provider, kind, settings, active) VALUES
       ($1, 'stripe', 'payment', '{"secret_key_env":"STRIPE_SECRET_KEY"}'::jsonb, false),
       ($1, 'melhor_envio', 'shipping', '{"token_env":"MELHOR_ENVIO_TOKEN"}'::jsonb, false)
     ON CONFLICT (tenant_id, provider) DO NOTHING`,
    [STORE_ID],
  );
}

async function seedDemoCatalog(client) {
  const categories = [
    ['Novidades', 'novidades', 'Produtos recém-chegados na loja.'],
    ['Mais vendidos', 'mais-vendidos', 'Os favoritos dos clientes.'],
  ];
  for (const [nome, slug, descricao] of categories) {
    await client.query(
      `INSERT INTO categories (tenant_id, nome, slug, descricao) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, slug) WHERE slug IS NOT NULL DO NOTHING`,
      [STORE_ID, nome, slug, descricao],
    );
  }
  const products = [
    ['Produto de exemplo 1', 'produto-exemplo-1', 'DEMO-001', 79.9, 10, 'novidades'],
    ['Produto de exemplo 2', 'produto-exemplo-2', 'DEMO-002', 129.9, 5, 'mais-vendidos'],
  ];
  for (const [nome, slug, sku, preco, estoque, categorySlug] of products) {
    await client.query(
      `INSERT INTO products (tenant_id, nome, slug, sku, preco, estoque, descricao, categoria_id)
       SELECT $1, $2, $3, $4, $5, $6, 'Produto criado pelo seed de demonstração.', id FROM categories WHERE tenant_id=$1 AND slug=$7
       ON CONFLICT (tenant_id, slug) WHERE slug IS NOT NULL DO NOTHING`,
      [STORE_ID, nome, slug, sku, preco, estoque, categorySlug],
    );
  }
  await client.query(
    `INSERT INTO coupons (tenant_id, code, description, discount_type, discount_value, min_order_value, active)
     VALUES ($1, 'BEMVINDO10', 'Cupom de demonstração com 10% de desconto', 'percent', 10, 0, true)
     ON CONFLICT (tenant_id, code) DO NOTHING`,
    [STORE_ID],
  );
}

async function main() {
  const storeName = String(process.env.STORE_NAME || 'Minha Loja').trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const store = await client.query('SELECT id FROM tenants WHERE id=$1', [STORE_ID]);
    if (!store.rowCount) throw new Error('Loja nao encontrada. Execute "npm run migrate" antes do seed.');
    await seedStore(client, storeName);
    const adminEmail = await seedAdmin(client);
    await seedIntegrations(client);
    if (process.env.SEED_DEMO === 'true') await seedDemoCatalog(client);
    await client.query('COMMIT');
    console.log(`Seed concluido: loja "${storeName}", administrador ${adminEmail}${process.env.SEED_DEMO === 'true' ? ', catalogo de demonstracao' : ''}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
