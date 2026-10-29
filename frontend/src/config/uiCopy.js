export const uiCopy = Object.freeze({
  actions: Object.freeze({
    addToCart: 'Adicionar ao carrinho',
    viewDetails: 'Ver detalhes',
    remove: 'Remover',
    closeNotification: 'Fechar notificação',
  }),
  product: Object.freeze({
    uncategorized: 'Sem categoria',
    noDescription: 'Produto sem descrição cadastrada.',
    unavailable: 'Produto indisponível',
    imageUnavailable: (name) => `Imagem indisponível para ${name}`,
  }),
  feedback: Object.freeze({
    info: 'Informação',
    success: 'Tudo certo',
    error: 'Não foi possível concluir',
    warning: 'Atenção',
  }),
  whiteLabel: Object.freeze({
    welcome: 'Encontre produtos que combinam com você',
    cartEmpty: 'Seu carrinho está vazio',
    checkoutSuccess: 'Pedido realizado com sucesso.',
  }),
});

export function copyWithOverrides(overrides = {}) {
  return {
    ...uiCopy,
    ...overrides,
    actions: { ...uiCopy.actions, ...overrides.actions },
    product: { ...uiCopy.product, ...overrides.product },
    feedback: { ...uiCopy.feedback, ...overrides.feedback },
    whiteLabel: { ...uiCopy.whiteLabel, ...overrides.whiteLabel },
  };
}
