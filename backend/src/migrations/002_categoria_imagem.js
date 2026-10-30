// Imagem de capa da categoria, exibida nos cartoes de categoria da pagina inicial.
module.exports = {
  async up(client) {
    await client.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS imagem TEXT');
  },
  async down(client) {
    await client.query('ALTER TABLE categories DROP COLUMN IF EXISTS imagem');
  },
};
