const { providers } = require('../src/services/payment.service');

const settings = { secret_key_env: 'STRIPE_TEST_KEY', api_url: 'https://stripe.test' };
const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, text: async () => JSON.stringify(body) });

describe('adaptador Stripe', () => {
  beforeEach(() => { process.env.STRIPE_TEST_KEY = 'sk_test_123'; global.fetch = jest.fn(); });
  afterEach(() => { delete process.env.STRIPE_TEST_KEY; delete global.fetch; });

  test('cria PaymentIntent somente para cartao, com captura manual e idempotencia', async () => {
    fetch.mockReturnValueOnce(reply({ id: 'pi_1', status: 'requires_payment_method', client_secret: 'pi_1_secret' }));
    const result = await providers.stripe.create({ amount: 99.9, currency: 'BRL', settings, metadata: { checkout_session_id: 7 } });
    const [url, options] = fetch.mock.calls[0];
    const body = new URLSearchParams(options.body);
    expect(url).toBe('https://stripe.test/v1/payment_intents');
    expect(body.get('amount')).toBe('9990');
    expect(body.get('capture_method')).toBe('manual');
    expect(body.get('payment_method_types[]')).toBe('card');
    expect(options.headers['idempotency-key']).toBe('checkout-7');
    expect(options.headers.authorization).toBe('Bearer sk_test_123');
    expect(result).toEqual({ external_id: 'pi_1', status: 'requires_payment_method', client: { client_secret: 'pi_1_secret' } });
  });

  test.each([
    ['requires_capture', true],
    ['succeeded', true],
    ['requires_payment_method', false],
    ['canceled', false],
  ])('status %s confirmado = %s', async (status, confirmed) => {
    fetch.mockReturnValueOnce(reply({ id: 'pi_1', status, amount: 9990, currency: 'brl' }));
    const result = await providers.stripe.verify({ externalId: 'pi_1', settings });
    expect(result.confirmed).toBe(confirmed);
    expect(result.amount_cents).toBe(9990);
  });

  test('captura autorizacao pendente e ignora pagamento ja capturado', async () => {
    fetch.mockReturnValueOnce(reply({ id: 'pi_1', status: 'requires_capture' })).mockReturnValueOnce(reply({ id: 'pi_1', status: 'succeeded' }));
    await expect(providers.stripe.capture({ externalId: 'pi_1', settings })).resolves.toEqual({ captured: true });
    expect(fetch.mock.calls[1][0]).toBe('https://stripe.test/v1/payment_intents/pi_1/capture');

    fetch.mockClear();
    fetch.mockReturnValueOnce(reply({ id: 'pi_1', status: 'succeeded' }));
    await providers.stripe.capture({ externalId: 'pi_1', settings });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('captura que nao conclui gera erro para desfazer o pedido', async () => {
    fetch.mockReturnValueOnce(reply({ id: 'pi_1', status: 'requires_capture' })).mockReturnValueOnce(reply({ id: 'pi_1', status: 'processing' }));
    await expect(providers.stripe.capture({ externalId: 'pi_1', settings })).rejects.toThrow('processing');
  });

  test('cancela autorizacao quando o pedido nao pode ser concluido', async () => {
    fetch.mockReturnValueOnce(reply({ id: 'pi_1', status: 'canceled' }));
    await expect(providers.stripe.cancel({ externalId: 'pi_1', settings })).resolves.toEqual({ canceled: true });
    expect(fetch.mock.calls[0][0]).toBe('https://stripe.test/v1/payment_intents/pi_1/cancel');
  });

  test('erro da Stripe e propagado sem expor a chave', async () => {
    fetch.mockReturnValueOnce(reply({ error: { message: 'Your card was declined.' } }, 402));
    await expect(providers.stripe.verify({ externalId: 'pi_1', settings })).rejects.toThrow('Your card was declined.');
  });

  test('sem a variavel de ambiente configurada a operacao e recusada', async () => {
    delete process.env.STRIPE_TEST_KEY;
    await expect(providers.stripe.verify({ externalId: 'pi_1', settings })).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
