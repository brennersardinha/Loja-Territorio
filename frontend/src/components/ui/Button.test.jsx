import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger', 'dark'])('renderiza a variante %s', (variant) => {
    const view = render(<Button variant={variant}>Continuar</Button>);
    expect(view.getByRole('button', { name: 'Continuar' })).toHaveClass(`ui-button--${variant}`);
    view.unmount();
  });

  it('bloqueia clique duplicado durante loading', () => {
    const onClick = vi.fn();
    render(<Button loading loadingLabel="Salvando…" onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
