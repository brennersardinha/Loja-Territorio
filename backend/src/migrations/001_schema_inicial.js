const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.join(__dirname, 'sql', '001_schema_inicial.sql'), 'utf8');

module.exports = {
  async up(client) {
    await client.query(schema);
    // A loja unica precisa existir com id 1: todas as colunas tenant_id usam DEFAULT 1.
    await client.query(`INSERT INTO tenants (id, name, slug, status) VALUES (1, 'Minha Loja', 'default', 'active')`);
    await client.query(`SELECT setval('tenants_id_seq', 1)`);
    await client.query(`
      INSERT INTO store_settings (tenant_id, key, value, description) VALUES
        (1, 'currency', '{"code":"BRL","symbol":"R$","decimals":2}'::jsonb, 'Moeda padrão da loja'),
        (1, 'tax_rates', '[]'::jsonb, 'Lista de regras de imposto'),
        (1, 'shipping_methods', '[]'::jsonb, 'Métodos de envio disponíveis')
    `);
  },
  down: null,
};
