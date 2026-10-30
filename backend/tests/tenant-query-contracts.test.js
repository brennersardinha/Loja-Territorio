const fs = require('fs');
const path = require('path');

const route = (name) => fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', name), 'utf8');

// As consultas continuam filtrando por tenant_id: o schema exige a coluna e a loja unica usa o id 1.
describe('contratos SQL da loja', () => {
  test.each([
    ['leitura, criação, atualização e exclusão de produtos', 'product.routes.js', [/p\.tenant_id = \$1/, /INSERT INTO products \(tenant_id/, /AND tenant_id = \$19/, /DELETE FROM products WHERE id = \$1 AND tenant_id = \$2/]],
    ['categorias', 'category.routes.js', [/WHERE c\.tenant_id = \$1/, /INSERT INTO categories \(tenant_id/, /AND tenant_id=\$9/, /DELETE FROM categories WHERE id = \$1 AND tenant_id=\$2/]],
    ['carrinhos', 'cart.routes.js', [/carts WHERE usuario_id = \$1 AND tenant_id = \$2/, /ci\.tenant_id=\$2/, /products WHERE id = \$1 AND tenant_id=\$2/]],
    ['wishlist', 'wishlist.routes.js', [/wi\.tenant_id=\$2/, /wishlist_items \(usuario_id, produto_id,tenant_id\)/]],
    ['checkout, cupons, pedidos, clientes e tracking', 'sprint6.routes.js', [/getCouponByCode\(code, tenantId/, /checkout_sessions[\s\S]*tenant_id,usuario_id/, /orders[\s\S]*tenant_id,usuario_id/, /addresses[\s\S]*tenant_id,usuario_id/, /shipping_tracking[\s\S]*tenant_id=\$2/]],
    ['configurações e operacoes administrativas', 'admin.routes.js', [/store_settings WHERE tenant_id=\$1/, /coupons WHERE tenant_id=\$1/, /o\.tenant_id = \$1/]],
    ['branding', 'branding.routes.js', [/tenant_branding \(tenant_id/, /WHERE t\.id=\$2/]],
    ['marketing', 'marketing.routes.js', [/tenant_marketing_settings WHERE tenant_id=\$1/, /tenant_marketing_settings\(tenant_id/]],
    ['sitemap e robots', 'seo.routes.js', [/tenant_marketing_settings WHERE tenant_id=\$1/, /products WHERE tenant_id=\$1/]],
  ])('%s filtram pela loja', (_label, file, patterns) => {
    const source = route(file);
    for (const pattern of patterns) expect(source).toMatch(pattern);
  });

  test('nenhuma rota consulta tabelas removidas da plataforma', () => {
    const removed = /\b(content_pages|blog_posts|blog_categories|blog_comments|tenant_domains|plans|tenant_subscriptions|billing_\w+|console_\w+)\b/;
    for (const file of fs.readdirSync(path.join(__dirname, '..', 'src', 'routes'))) {
      expect([file, route(file).match(removed)?.[0]]).toEqual([file, undefined]);
    }
  });
});
