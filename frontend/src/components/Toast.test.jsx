import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Toast from './Toast';

describe('Toast', () => {
  it('anuncia erro, executa a ação e permite fechar', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<Toast toast={{ id: 1, type: 'error', message: 'Revise o endereço.', actionLabel: 'Corrigir', onAction }} onClose={onClose} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível concluir');
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('impede o fechamento automático enquanto recebe foco', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast toast={{ id: 2, type: 'success', message: 'Perfil salvo.' }} onClose={onClose} />);
    fireEvent.focus(screen.getByRole('status'));
    vi.advanceTimersByTime(6000);
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
