import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('confirma, fecha com Escape e devolve o foco', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(<Modal open title="Excluir produto?" description="Ação permanente" onClose={onClose} onConfirm={onConfirm} danger />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<Modal open={false} title="Excluir produto?" description="Ação permanente" onClose={onClose} onConfirm={onConfirm} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
