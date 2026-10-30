// Etiquetas de envio/separação: uma por pedido, com código sequencial único e contagem de impressões.
module.exports = {
  async up(client) {
    await client.query('CREATE SEQUENCE IF NOT EXISTS order_label_code_seq');
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_labels (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        code VARCHAR(32) NOT NULL,
        volumes INTEGER NOT NULL DEFAULT 1 CHECK (volumes BETWEEN 1 AND 50),
        weight_kg NUMERIC(10,3) CHECK (weight_kg IS NULL OR weight_kg > 0),
        print_count INTEGER NOT NULL DEFAULT 0,
        last_printed_at TIMESTAMPTZ,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS order_labels_order_uidx ON order_labels (tenant_id, order_id)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS order_labels_code_uidx ON order_labels (code)');
  },
  async down(client) {
    await client.query('DROP TABLE IF EXISTS order_labels');
    await client.query('DROP SEQUENCE IF EXISTS order_label_code_seq');
  },
};
