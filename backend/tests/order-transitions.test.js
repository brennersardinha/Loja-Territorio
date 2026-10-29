const { canTransitionOrder, ORDER_TRANSITIONS } = require('../src/routes/admin.routes');

describe('máquina de estados de pedidos', () => {
  test.each([
    ['pending', 'paid'], ['paid', 'processing'], ['processing', 'shipped'],
    ['shipped', 'delivered'], ['shipped', 'returned'],
  ])('aceita %s -> %s', (from, to) => expect(canTransitionOrder(from, to)).toBe(true));

  test.each([
    ['pending', 'delivered'], ['paid', 'shipped'], ['delivered', 'processing'],
    ['cancelled', 'paid'], ['unknown', 'paid'],
  ])('rejeita %s -> %s', (from, to) => expect(canTransitionOrder(from, to)).toBe(false));

  test('mantém todos os estados explicitamente registrados', () => {
    expect(Object.keys(ORDER_TRANSITIONS)).toEqual(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']);
  });
});
