const express = require('express');
const request = require('supertest');
const { createLabelRouter } = require('../src/routes/label.routes');
const { parseOrderIds, validateLabelUpdate, buildSender, LABEL_ELIGIBLE_STATUSES } = require('../src/services/order-label.service');

function appWith(db, role = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { id: 1 }; next(); });
  app.use('/api/admin', createLabelRouter({ pool: db, authenticateToken: (req, _res, next) => { req.user = { id: 9, role }; next(); } }));
  return app;
}

// Banco simulado que responde pelo conteúdo do SQL, como o motor faz as consultas em sequência.
function fakeDb({ orders = [], labels = [] } = {}) {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id, status FROM orders')) return { rows: orders };
      if (sql.includes('INSERT INTO order_labels')) return { rowCount: labels.length };
      if (sql.includes('JOIN order_labels l')) return { rows: labels };
      if (sql.includes('FROM order_items')) return { rows: [{ order_id: 5, nome_produto: 'Couro Napa', quantidade: 2, sku: 'COU-1', peso_kg: '0.6', atributos_dinamicos: { Unidade: 'm²' } }] };
      if (sql.includes('FROM shipping_tracking')) return { rows: [] };
      if (sql.includes('store_settings')) return { rows: [{ value: { sender: { name: 'Território do Couro LTDA', zip_code: '74513-040' } } }] };
      if (sql.includes('FROM tenants')) return { rows: [{ name: 'Território do Couro' }] };
      if (sql.startsWith('UPDATE order_labels SET print_count')) return { rows: params[1].map((id) => ({ id, print_count: 1 })) };
      return { rows: [], rowCount: 0 };
    }),
  };
}

const labelRow = { id: 5, public_reference: 'PED-ABC', status: 'paid', shipping_method: 'express', shipping_address_snapshot: { recipient_name: 'Maria', street: 'Rua 15', number: '220', city: 'Franca', state: 'SP', zip_code: '14400-000' }, total: '334.90', customer_name: 'Maria', customer_email: 'maria@x.com', label_id: 1, code: 'ETQ-2026-000001', volumes: 2, weight_kg: null, print_count: 0 };

describe('motor de etiquetas', () => {
  test('gera uma etiqueta por pedido pago e explica os pedidos ignorados', async () => {
    const db = fakeDb({ orders: [{ id: 5, status: 'paid' }, { id: 6, status: 'pending' }], labels: [labelRow] });
    const response = await request(appWith(db)).post('/api/admin/labels').send({ order_ids: [5, 6, 7] });
    expect(response.status).toBe(200);
    expect(response.body.labels).toHaveLength(1);
    expect(response.body.labels[0]).toMatchObject({
      label: { code: 'ETQ-2026-000001', volumes: 2, weight_kg: null, estimated_weight_kg: 1.2, measured: false },
      order: { reference: 'PED-ABC', service: 'Expresso', is_pickup: false, items_count: 2 },
      recipient: { name: 'Maria', zip_code: '14400-000' },
      sender: { name: 'Território do Couro LTDA', zip_code: '74513-040' },
      items: [{ name: 'Couro Napa', sku: 'COU-1', quantity: 2, unit: 'm²' }],
    });
    expect(response.body.skipped).toEqual([
      { order_id: 6, reason: 'Pedido sem pagamento confirmado, cancelado ou devolvido.' },
      { order_id: 7, reason: 'Pedido não encontrado.' },
    ]);
    const insert = db.calls.find((call) => call.sql.includes('INSERT INTO order_labels'));
    expect(insert.sql).toMatch(/ON CONFLICT \(tenant_id, order_id\) DO NOTHING/);
    expect(insert.sql).toMatch(/nextval\('order_label_code_seq'\)/);
    expect(insert.params[1]).toEqual([5]);
  });

  test('serializa gerações simultâneas com lock dentro de uma transação', async () => {
    const db = fakeDb({ orders: [{ id: 5, status: 'paid' }], labels: [labelRow] });
    const client = { query: db.query, release: jest.fn() };
    db.connect = jest.fn(async () => client);
    await request(appWith(db)).post('/api/admin/labels').send({ order_ids: [5] });
    const sequence = db.calls.map(({ sql }) => sql.trim().split(/\s+/).slice(0, 2).join(' '));
    const begin = sequence.indexOf('BEGIN');
    expect(sequence.slice(begin, begin + 4)).toEqual(['BEGIN', 'SELECT pg_advisory_xact_lock(hashtext(\'order_labels\'),', 'INSERT INTO', 'COMMIT']);
    expect(client.release).toHaveBeenCalled();
  });

  test('pedido de retirada sai como "Retirada na loja"', async () => {
    const db = fakeDb({ orders: [{ id: 5, status: 'processing' }], labels: [{ ...labelRow, shipping_method: 'pickup', shipping_address_snapshot: { type: 'pickup' } }] });
    const response = await request(appWith(db)).post('/api/admin/labels').send({ order_ids: [5] });
    expect(response.body.labels[0].order).toMatchObject({ service: 'Retirada na loja', is_pickup: true });
  });

  test('cliente não gera etiquetas', async () => {
    const response = await request(appWith(fakeDb(), 'customer')).post('/api/admin/labels').send({ order_ids: [5] });
    expect(response.status).toBe(403);
  });

  test('valida lote, volumes e peso', () => {
    expect(() => parseOrderIds([])).toThrow();
    expect(() => parseOrderIds(Array.from({ length: 101 }, (_, i) => i + 1))).toThrow();
    expect(parseOrderIds(['3', 3, 4])).toEqual([3, 4]);
    expect(validateLabelUpdate({ volumes: 0, weight_kg: 1 }).errors).toHaveLength(1);
    expect(validateLabelUpdate({ volumes: 3, weight_kg: '2.5' })).toEqual({ errors: [], data: { volumes: 3, weight_kg: 2.5 } });
    expect(validateLabelUpdate({ volumes: 1, weight_kg: -1 }).errors).toHaveLength(1);
    // Peso é obrigatório: não existe etiqueta de envio com peso estimado.
    expect(validateLabelUpdate({ volumes: 2 }).errors).toEqual(['Informe o peso real do pacote: maior que zero e de até 1000 kg.']);
    expect(LABEL_ELIGIBLE_STATUSES).not.toContain('pending');
  });

  test('registra a impressão das etiquetas', async () => {
    const db = fakeDb();
    const response = await request(appWith(db)).post('/api/admin/labels/printed').send({ label_ids: [1, 1, 2] });
    expect(response.body.labels).toEqual([{ id: 1, print_count: 1 }, { id: 2, print_count: 1 }]);
  });

  test('remetente usa os dados da loja como reserva', () => {
    expect(buildSender({ pickup: { address: 'Av. Mato Grosso, 114' }, contact: { phone: '(62) 8159-8510' } }, 'Território do Couro')).toMatchObject({ name: 'Território do Couro', address: 'Av. Mato Grosso, 114', phone: '(62) 8159-8510' });
  });
});
