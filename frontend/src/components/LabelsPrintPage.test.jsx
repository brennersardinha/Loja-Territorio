import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LabelsPrintPage from './LabelsPrintPage';

const payload = {
  label: { id: 1, code: 'ETQ-2026-000001', volumes: 2, weight_kg: 1.2, weight_is_estimate: true, print_count: 0 },
  order: { id: 5, reference: 'PED-ABC', created_at: '2026-10-30T12:00:00Z', service: 'Expresso', is_pickup: false, items_count: 2 },
  recipient: { name: 'Maria Sapateira', street: 'Rua 15', number: '220', complement: 'Galpão 2', neighborhood: 'Centro', city: 'Franca', state: 'SP', zip_code: '14400-000' },
  sender: { name: 'Território do Couro', document: '00.939.693/0001-80', address: 'Av. Mato Grosso, 114', zip_code: '74513-040', phone: '(62) 8159-8510' },
  items: [{ name: 'Couro Napa Caramelo', sku: 'COU-NAP-CAR', quantity: 2, unit: 'm²' }],
  tracking: null,
};

function renderPage(url = '/admin/etiquetas?pedidos=5,6') {
  return render(<MemoryRouter initialEntries={[url]}><LabelsPrintPage token="csrf" /></MemoryRouter>);
}

describe('LabelsPrintPage', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('gera uma etiqueta única por volume e a ficha de separação do pedido', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ labels: [payload], skipped: [{ order_id: 6, reason: 'Pedido sem pagamento confirmado, cancelado ou devolvido.' }] }) }));
    renderPage();
    expect(await screen.findByLabelText('Etiqueta de envio ETQ-2026-000001-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Etiqueta de envio ETQ-2026-000001-2')).toBeInTheDocument();
    expect(screen.getByLabelText('Ficha de separação ETQ-2026-000001')).toBeInTheDocument();
    expect(screen.getAllByText('CEP 14400-000')).toHaveLength(2);
    expect(screen.getByText('Pedido 6: Pedido sem pagamento confirmado, cancelado ou devolvido.')).toBeInTheDocument();
    // Folha 1: volume 1 + ficha (paisagem); folha 2: volume extra.
    expect(screen.getByRole('button', { name: 'Imprimir 2 folhas' })).toBeInTheDocument();
    const [firstSheet] = document.querySelectorAll('.label-sheet-landscape');
    expect(firstSheet.querySelector('[aria-label="Etiqueta de envio ETQ-2026-000001-1"]')).toBeTruthy();
    expect(firstSheet.querySelector('[aria-label="Ficha de separação ETQ-2026-000001"]')).toBeTruthy();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ order_ids: [5, 6] });
  });

  it('agrupa volumes extras dois por folha em paisagem', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ labels: [{ ...payload, label: { ...payload.label, volumes: 4 } }], skipped: [] }) }));
    renderPage('/admin/etiquetas?pedidos=5');
    await screen.findByLabelText('Etiqueta de envio ETQ-2026-000001-4');
    const sheets = [...document.querySelectorAll('.label-sheet-landscape')].map((sheet) => sheet.querySelectorAll('.label-page').length);
    expect(sheets).toEqual([2, 2, 1]);
  });

  it('imprime só a ficha de separação quando escolhido', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ labels: [payload], skipped: [] }) }));
    renderPage();
    fireEvent.click(await screen.findByLabelText('Só ficha de separação'));
    expect(screen.queryByLabelText('Etiqueta de envio ETQ-2026-000001-1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir 1 folha' })).toBeInTheDocument();
  });

  it('ajusta volumes e registra a impressão', async () => {
    global.fetch = vi.fn(async (url, options) => {
      if (url === '/api/admin/orders/5/label') return { ok: true, json: async () => ({ label: { ...payload, label: { ...payload.label, volumes: 3 } } }) };
      return { ok: true, json: async () => ({ labels: [payload], skipped: [] }) };
    });
    renderPage('/admin/etiquetas?pedidos=5');
    fireEvent.change(await screen.findByLabelText('Volumes'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByLabelText('Etiqueta de envio ETQ-2026-000001-3')).toBeInTheDocument();
    window.dispatchEvent(new Event('afterprint'));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/labels/printed', expect.objectContaining({ body: JSON.stringify({ label_ids: [1] }) })));
  });
});
