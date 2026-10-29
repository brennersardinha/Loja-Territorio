export const ORDER_STATUSES = {
  pending: { label: 'Aguardando pagamento', description: 'O pagamento ainda precisa ser confirmado.', variant: 'warning' },
  paid: { label: 'Pagamento confirmado', description: 'O pedido foi pago e será preparado em breve.', variant: 'info' },
  processing: { label: 'Em preparação', description: 'A loja está separando os itens do pedido.', variant: 'info' },
  shipped: { label: 'Enviado', description: 'O pedido já está com a transportadora.', variant: 'info' },
  delivered: { label: 'Entregue', description: 'A entrega foi concluída.', variant: 'success' },
  cancelled: { label: 'Cancelado', description: 'O pedido foi cancelado.', variant: 'danger' },
  returned: { label: 'Devolvido', description: 'O pedido retornou para a loja.', variant: 'neutral' },
};

const PICKUP_STATUSES = {
  shipped: { label: 'Pronto para retirada', description: 'O pedido está separado e pode ser retirado na loja.', variant: 'info' },
  delivered: { label: 'Retirado', description: 'O pedido foi retirado na loja.', variant: 'success' },
};

// Pedidos com retirada na loja usam rotulos proprios para "enviado" e "entregue".
export function getOrderStatus(status, order = null) {
  const key = String(status || '').toLowerCase();
  if (order?.shipping_method === 'pickup' && PICKUP_STATUSES[key]) return PICKUP_STATUSES[key];
  return ORDER_STATUSES[key] || {
    label: 'Status indisponível',
    description: 'Ainda não há uma atualização disponível para este pedido.',
    variant: 'neutral',
  };
}

export function orderReference(order) {
  return order?.public_reference || 'Referência indisponível';
}

export const orderStatusOptions = Object.entries(ORDER_STATUSES).map(([value, metadata]) => ({ value, ...metadata }));

const transitions = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: [],
  cancelled: [],
  returned: [],
};

export function nextOrderStatusOptions(currentStatus) {
  const current = String(currentStatus || '').toLowerCase();
  return orderStatusOptions.filter(({ value }) => value === current || transitions[current]?.includes(value));
}
