const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const migrationsDirectory = path.join(__dirname, 'migrations');
const migrationPattern = /^\d{3}_[a-z0-9_]+\.js$/;

function availableMigrations() {
  return fs.readdirSync(migrationsDirectory)
    .filter((file) => migrationPattern.test(file))
    .sort()
    .map((file) => ({ name: file, migration: require(path.join(migrationsDirectory, file)) }));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrationNames(client) {
  const result = await client.query('SELECT name FROM schema_migrations ORDER BY name');
  return new Set(result.rows.map((row) => row.name));
}

async function withMigrationLock(callback) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('ecommerce_schema_migrations'))");
    await client.query('BEGIN');
    transactionStarted = true;
    await ensureMigrationsTable(client);
    const result = await callback(client);
    await client.query('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('ecommerce_schema_migrations'))");
    client.release();
  }
}

async function up() {
  await withMigrationLock(async (client) => {
    const applied = await appliedMigrationNames(client);
    for (const item of availableMigrations()) {
      if (applied.has(item.name)) continue;
      if (typeof item.migration.up !== 'function') throw new Error(`Migration ${item.name} nao exporta up()`);
      await item.migration.up(client);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [item.name]);
      console.log(`Aplicada: ${item.name}`);
    }
  });
}

async function status() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrationNames(client);
    for (const item of availableMigrations()) {
      console.log(`${applied.has(item.name) ? 'aplicada' : 'pendente'}  ${item.name}`);
    }
  } finally {
    client.release();
  }
}

async function down() {
  await withMigrationLock(async (client) => {
    const result = await client.query('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');
    if (!result.rows.length) return console.log('Nenhuma migration aplicada.');
    const name = result.rows[0].name;
    const item = availableMigrations().find((candidate) => candidate.name === name);
    if (!item) throw new Error(`Migration aplicada nao existe no codigo: ${name}`);
    if (typeof item.migration.down !== 'function') {
      throw new Error(`Migration ${name} e irreversivel; restaure o backup ou aplique uma migration corretiva.`);
    }
    await item.migration.down(client);
    await client.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
    console.log(`Revertida: ${name}`);
  });
}

async function main() {
  const command = process.argv[2] || 'up';
  if (command === 'up') await up();
  else if (command === 'status') await status();
  else if (command === 'down') await down();
  else throw new Error(`Comando desconhecido: ${command}. Use up, status ou down.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
