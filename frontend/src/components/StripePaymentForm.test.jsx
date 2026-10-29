import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import StripePaymentForm from './StripePaymentForm';

function mockStripe(confirmResult) {
  const element = { mount: vi.fn(), destroy: vi.fn(), on: vi.fn((event, callback) => event === 'ready' && callback()) };
  const elements = { create: vi.fn(() => element) };
  const stripe = { elements: vi.fn(() => elements), confirmPayment: vi.fn(async () => confirmResult) };
  window.Stripe = vi.fn(() => stripe);
  return { stripe, element };
}

describe('StripePaymentForm', () => {
  afterEach(() => { cleanup(); delete window.Stripe; vi.restoreAllMocks(); });

  test('monta o Payment Element e conclui o pedido apos autorizacao', async () => {
    const { stripe, element } = mockStripe({ paymentIntent: { status: 'requires_capture' } });
    const onAuthorized = vi.fn(async () => {});
    render(<StripePaymentForm publishableKey="pk_test_1" clientSecret="pi_1_secret" checkoutSessionId={42} onAuthorized={onAuthorized} />);
    await waitFor(() => expect(element.mount).toHaveBeenCalled());
    expect(stripe.elements).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'pi_1_secret' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Pagar e finalizar pedido' }));
    await waitFor(() => expect(onAuthorized).toHaveBeenCalled());
    expect(stripe.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/checkout?checkout_session_id=42` },
    }));
  });

  test('cartao recusado mostra o erro e nao cria o pedido', async () => {
    mockStripe({ error: { message: 'Seu cartão foi recusado.' } });
    const onAuthorized = vi.fn();
    render(<StripePaymentForm publishableKey="pk_test_1" clientSecret="pi_1_secret" checkoutSessionId={42} onAuthorized={onAuthorized} />);
    const button = await screen.findByRole('button', { name: 'Pagar e finalizar pedido' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    expect(await screen.findByText('Seu cartão foi recusado.')).toBeInTheDocument();
    expect(onAuthorized).not.toHaveBeenCalled();
  });
});
