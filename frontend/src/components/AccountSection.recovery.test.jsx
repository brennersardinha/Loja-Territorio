import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AccountSection from './AccountSection';

const base = {
  user: null, isRegister: false, authForm: { nome: '', email: 'dono@example.test', senha: '' }, profileForm: {},
  onAuthFormChange: vi.fn(), onProfileFormChange: vi.fn(), submitAuth: vi.fn(), submitProfile: vi.fn(),
  requestPasswordReset: vi.fn(), resetPassword: vi.fn(), setMode: vi.fn(), loading: false, status: '',
  formatPrice: vi.fn(), formatDateTime: vi.fn(), userOrders: [], fetchUserOrders: vi.fn(),
  userOrderDetail: null, userOrderTracking: null, fetchUserOrderTracking: vi.fn(),
};

describe('recuperação de senha da loja', () => {
  it('solicita instruções para o e-mail informado', () => {
    const requestPasswordReset = vi.fn();
    render(<MemoryRouter><AccountSection {...base} mode="forgot" requestPasswordReset={requestPasswordReset}/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(requestPasswordReset).toHaveBeenCalledWith('dono@example.test');
  });
  it('exige confirmação idêntica antes de redefinir', () => {
    render(<MemoryRouter><AccountSection {...base} mode="reset"/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha-segura-123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'diferente-12345' } });
    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem');
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled();
  });
});
