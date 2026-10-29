import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Alert from './Alert';
import Badge from './Badge';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';

describe('feedback compartilhado', () => {
  it('combina texto e ícone nos status', () => {
    render(<Badge variant="success">Pagamento aprovado</Badge>);
    expect(screen.getByText('Pagamento aprovado')).toBeInTheDocument();
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true');
  });

  it('anuncia erros e loading', () => {
    render(<><Alert variant="error" title="Pagamento recusado">Tente outra forma.</Alert><Skeleton label="Carregando pedidos" /></>);
    expect(screen.getByRole('alert')).toHaveTextContent('Pagamento recusado');
    expect(screen.getByRole('status', { name: 'Carregando pedidos' })).toBeInTheDocument();
  });

  it('oferece ação no estado vazio', () => {
    render(<EmptyState title="Nenhum pedido" actionLabel="Comprar agora" onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Comprar agora' })).toBeInTheDocument();
  });
});
