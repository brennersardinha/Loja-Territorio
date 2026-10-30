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
    badges: Object.freeze({ sale: 'Oferta', lowStock: 'Últimas unidades', new: 'Novo' }),
  }),
  pickup: Object.freeze({
    short: 'Retire grátis na loja',
  }),
  feedback: Object.freeze({
    info: 'Informação',
    success: 'Tudo certo',
    error: 'Não foi possível concluir',
    warning: 'Atenção',
  }),
  whiteLabel: Object.freeze({
    welcome: 'Encontre produtos que combinam com você',
    heroCta: 'Ver produtos',
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
    pickup: { ...uiCopy.pickup, ...overrides.pickup },
    feedback: { ...uiCopy.feedback, ...overrides.feedback },
    whiteLabel: { ...uiCopy.whiteLabel, ...overrides.whiteLabel },
  };
}
