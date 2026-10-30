const fs = require('fs');
const path = require('path');

const source = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('contratos comerciais do checkout', () => {
  const checkout = source('src/routes/sprint6.routes.js');
  const integrations = source('src/routes/integration.routes.js');
  const immutable = source('src/migrations/sql/001_schema_inicial.sql');

  test('checkout válida endereço, frete e cupom no tenant', () => {
    expect(checkout).toMatch(/addresses[\s\S]*usuario_id = \$2 AND tenant_id=\$3/);
    expect(checkout).toMatch(/shipping_quotes WHERE id=\$1 AND usuario_id=\$2 AND tenant_id=\$3/);
    expect(checkout).toMatch(/getCouponByCode\(couponCode, req\.tenant\.id\)/);
  });

  test('pedido bloqueia estoque e baixa somente no tenant com saldo', () => {
    expect(checkout).toMatch(/WHERE id = ANY\(\$1::int\[\]\) AND tenant_id=\$2[\s\S]*FOR UPDATE/);
    expect(checkout).toMatch(/AND tenant_id=\$3 AND estoque >= \$1 RETURNING id/);
    expect(checkout).toContain("await client.query('BEGIN')");
    expect(checkout).toContain("await client.query('COMMIT')");
  });

  test('checkout, pedido, itens, histórico e tracking carregam tenant', () => {
    for (const pattern of [
      /checkout_sessions \([\s\S]*tenant_id,usuario_id/,
      /orders \([\s\S]*tenant_id,usuario_id/,
      /order_items \([\s\S]*tenant_id/,
      /order_status_history \([\s\S]*tenant_id/,
      /shipping_tracking[\s\S]*tenant_id=\$2/,
    ]) expect(checkout).toMatch(pattern);
  });

  test('cotação usa apenas carrinho, produtos e provedores do tenant', () => {
    expect(integrations).toMatch(/c\.usuario_id=\$1 AND c\.tenant_id=\$2/);
    expect(integrations).toMatch(/quoteShipping\([\s\S]*req\.tenant\.id,db/);
    expect(integrations).toMatch(/shipping_quotes\(id,tenant_id,usuario_id/);
  });

  test('snapshots financeiros e itens do pedido são imutaveis no banco', () => {
    expect(immutable).toContain('prevent_order_snapshot_change');
    expect(immutable).toContain('prevent_order_item_change');
    expect(checkout).toContain('[order.id, product.id, item.nome, item.quantidade, item.preco_unitario,req.tenant.id]');
  });
});
