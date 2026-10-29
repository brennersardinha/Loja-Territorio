import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Field from './Field';

describe('Field', () => {
  it('associa label, ajuda e erro ao controle', () => {
    render(<Field label="E-mail" hint="Use seu e-mail principal" error="E-mail inválido" />);
    const input = screen.getByRole('textbox', { name: 'E-mail' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('hint');
    expect(input.getAttribute('aria-describedby')).toContain('message');
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail inválido');
  });

  it('mostra e oculta senha sem apagar o valor', () => {
    render(<Field label="Senha" type="password" defaultValue="segredo" />);
    const input = screen.getByLabelText('Senha');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('segredo');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
