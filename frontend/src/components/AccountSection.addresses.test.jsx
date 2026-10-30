import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountSection from './AccountSection';

const addresses = [
  { id: 1, street: 'Av. Mato Grosso', number: '114', neighborhood: 'Setor Campinas', city: 'Goiânia', state: 'GO', zip_code: '74513-040', recipient_name: 'Ana', is_default: true },
  { id: 2, street: 'Rua 10', number: '5', city: 'Anápolis', state: 'GO', zip_code: '75000-000', recipient_name: 'Ana', is_default: false },
];

function renderAccount(props = {}) {
  const handlers = { submitAddress: vi.fn(), removeAddress: vi.fn(), setDefaultAddress: vi.fn(), setAddressForm: vi.fn() };
  render(<MemoryRouter><AccountSection user={{ id: 1, nome: 'Ana' }} mode="login" profileForm={{ nome: 'Ana', email: 'ana@teste.com' }} authForm={{}} userOrders={[]} fetchUserOrders={vi.fn()} formatPrice={String} formatDateTime={String} addresses={addresses} addressForm={{ label: 'Casa', recipient_name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' }} {...handlers} {...props} /></MemoryRouter>);
  return handlers;
}

describe('AccountSection — endereços', () => {
  afterEach(cleanup);

  it('abre a aba de endereços na própria conta, sem levar ao checkout', () => {
    renderAccount();
    expect(screen.queryByRole('link', { name: 'Endereços' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Endereços' }));
    expect(screen.getByRole('heading', { name: 'Meus endereços' })).toBeInTheDocument();
    expect(screen.getByText('Av. Mato Grosso, 114')).toBeInTheDocument();
    expect(screen.getByText('Padrão')).toBeInTheDocument();
  });

  it('define endereço padrão e pede confirmação antes de remover', () => {
    const handlers = renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Endereços' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tornar padrão' }));
    expect(handlers.setDefaultAddress).toHaveBeenCalledWith(addresses[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Remover endereço Rua 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover endereço' }));
    expect(handlers.removeAddress).toHaveBeenCalledWith(2);
  });

  it('sem endereços, mostra direto o formulário com CEP', () => {
    renderAccount({ addresses: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Endereços' }));
    expect(screen.getByLabelText('CEP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar endereço' })).toBeInTheDocument();
  });
});
