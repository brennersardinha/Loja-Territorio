const { isSandboxEnabled, getPaymentProvider, providers } = require('../src/services/payment.service');

describe('pagamento de teste (sandbox)', () => {
  test.each([
    [{ NODE_ENV: 'production' }, false],
    [{ NODE_ENV: 'production', PAYMENT_SANDBOX_ENABLED: 'true' }, false],
    [{ NODE_ENV: 'development' }, true],
    [{ NODE_ENV: 'test', PAYMENT_SANDBOX_ENABLED: 'false' }, false],
  ])('%j -> %s', (env, expected) => expect(isSandboxEnabled(env)).toBe(expected));

  test('em producao o sandbox e recusado antes de confirmar qualquer pagamento', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(getPaymentProvider('sandbox', 1, { query: jest.fn() })).rejects.toMatchObject({ status: 400 });
    } finally { process.env.NODE_ENV = previous; }
  });

  test('somente stripe e sandbox estão disponíveis', () => {
    expect(Object.keys(providers).sort()).toEqual(['sandbox', 'stripe']);
  });
});
