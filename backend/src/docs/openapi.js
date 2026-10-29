const json = { 'application/json': { schema: { type: 'object', additionalProperties: true } } };
const bearer = [{ bearerAuth: [] }];

function operation(tags, summary, options = {}) {
  const result = {
    tags: [tags],
    summary,
    responses: {
      [options.success || '200']: { description: options.successDescription || 'Operação concluída', content: json },
      '400': { description: 'Requisição inválida', content: json },
      '500': { description: 'Erro interno', content: json },
    },
  };
  if (options.auth) {
    result.security = bearer;
    result.responses['401'] = { description: 'Token ausente ou inválido', content: json };
  }
  if (options.admin) result.responses['403'] = { description: 'Permissão insuficiente', content: json };
  if (options.body) {
    result.requestBody = {
      required: true,
      content: { 'application/json': { schema: { $ref: `#/components/schemas/${options.body}` } } },
    };
  }
  if (options.parameters) result.parameters = options.parameters;
  return result;
}

const id = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
const pagination = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
];

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Loja Online API',
    version: '1.1.0',
    description: 'Contrato oficial da API REST da loja online. Endpoints administrativos exigem as permissões RBAC indicadas pelas respostas 403.',
  },
  servers: [{ url: '/api', description: 'Servidor atual' }, { url: 'http://localhost:4000/api', description: 'Desenvolvimento local' }],
  tags: ['Autenticação', 'Produtos', 'Categorias', 'Carrinho', 'Desejos', 'Avaliações', 'Checkout', 'Pedidos', 'Endereços', 'Cupons', 'Administração', 'Marketing', 'Integrações', 'Webhooks'].map((name) => ({ name })),
  paths: {
    '/users/register': { post: operation('Autenticação', 'Cadastrar usuário', { body: 'RegisterInput', success: '201' }) },
    '/users/login': { post: operation('Autenticação', 'Autenticar usuário', { body: 'LoginInput' }) },
    '/password/forgot': { post: operation('Autenticação', 'Solicitar redefinição de senha com resposta neutra', { body: 'PasswordForgotInput' }) },
    '/password/reset': { post: operation('Autenticação', 'Redefinir senha com token de uso único', { body: 'PasswordResetInput' }) },
    '/users/logout': { post: operation('Autenticação', 'Encerrar sessão', { auth: true }) },
    '/users/profile': {
      get: operation('Autenticação', 'Consultar perfil', { auth: true }),
      put: operation('Autenticação', 'Atualizar perfil', { auth: true, body: 'ProfileInput' }),
    },
    '/users': { get: operation('Administração', 'Listar usuários para gestão de papéis', { auth: true, admin: true, parameters: pagination }) },
    '/products': {
      get: operation('Produtos', 'Listar e filtrar produtos', { parameters: [...pagination,
        { name: 'busca', in: 'query', schema: { type: 'string' } },
        { name: 'categoria_id', in: 'query', schema: { type: 'integer' } },
        { name: 'min_preco', in: 'query', schema: { type: 'number' } },
        { name: 'max_preco', in: 'query', schema: { type: 'number' } },
      ] }),
      post: operation('Produtos', 'Cadastrar produto', { auth: true, admin: true, body: 'ProductInput', success: '201' }),
    },
    '/products/{id}': {
      get: operation('Produtos', 'Consultar produto', { parameters: [id()] }),
      put: operation('Produtos', 'Atualizar produto', { auth: true, admin: true, body: 'ProductInput', parameters: [id()] }),
    },
    '/categories': {
      get: operation('Categorias', 'Listar categorias'),
      post: operation('Categorias', 'Cadastrar categoria', { auth: true, admin: true, body: 'CategoryInput', success: '201' }),
    },
    '/categories/{id}': {
      put: operation('Categorias', 'Atualizar categoria', { auth: true, admin: true, body: 'CategoryInput', parameters: [id()] }),
      delete: operation('Categorias', 'Excluir categoria', { auth: true, admin: true, parameters: [id()] }),
    },
    '/cart': { get: operation('Carrinho', 'Consultar carrinho', { auth: true }) },
    '/cart/add': { post: operation('Carrinho', 'Adicionar item ao carrinho', { auth: true, body: 'CartItemInput' }) },
    '/cart/update/{item_id}': { put: operation('Carrinho', 'Atualizar quantidade', { auth: true, body: 'QuantityInput', parameters: [id('item_id')] }) },
    '/cart/remove/{item_id}': { delete: operation('Carrinho', 'Remover item', { auth: true, parameters: [id('item_id')] }) },
    '/wishlist': {
      get: operation('Desejos', 'Listar desejos', { auth: true }),
      post: operation('Desejos', 'Adicionar produto aos desejos', { auth: true, body: 'ProductReference', success: '201' }),
    },
    '/wishlist/{produto_id}': { delete: operation('Desejos', 'Remover produto dos desejos', { auth: true, parameters: [id('produto_id')] }) },
    '/reviews/product/{produto_id}': { get: operation('Avaliações', 'Listar avaliações aprovadas do produto', { parameters: [id('produto_id'), ...pagination] }) },
    '/reviews': { post: operation('Avaliações', 'Criar avaliação', { auth: true, body: 'ReviewInput', success: '201' }) },
    '/reviews/{id}': {
      put: operation('Avaliações', 'Editar avaliação própria', { auth: true, body: 'ReviewInput', parameters: [id()] }),
      delete: operation('Avaliações', 'Excluir avaliação própria', { auth: true, parameters: [id()] }),
    },
    '/checkout/start': { post: operation('Checkout', 'Validar carrinho e iniciar checkout', { auth: true, body: 'CheckoutInput', success: '201' }) },
    '/shipping/quotes': { post: operation('Checkout', 'Cotar frete em transportadoras configuradas', { auth: true, body: 'ShippingQuoteInput' }) },
    '/orders': {
      get: operation('Pedidos', 'Listar pedidos do cliente', { auth: true, parameters: pagination }),
      post: operation('Pedidos', 'Finalizar pedido', { auth: true, body: 'OrderInput', success: '201' }),
    },
    '/orders/{id}/track': { get: operation('Pedidos', 'Rastrear pedido do cliente', { auth: true, parameters: [id()] }) },
    '/addresses': {
      get: operation('Endereços', 'Listar endereços', { auth: true }),
      post: operation('Endereços', 'Cadastrar endereço', { auth: true, body: 'AddressInput', success: '201' }),
    },
    '/addresses/{id}': {
      put: operation('Endereços', 'Atualizar endereço', { auth: true, body: 'AddressInput', parameters: [id()] }),
      delete: operation('Endereços', 'Excluir endereço', { auth: true, parameters: [id()] }),
    },
    '/coupons/validate': { post: operation('Cupons', 'Validar cupom', { body: 'CouponValidationInput' }) },
    '/branding': { get: operation('Administração', 'Consultar identidade visual da loja') },
    '/marketing-config': { get: operation('Marketing', 'Consultar configuração pública de marketing') },
    '/admin/branding': {
      get: operation('Administração', 'Consultar identidade visual', { auth: true, admin: true }),
      put: operation('Administração', 'Publicar identidade visual', { auth: true, admin: true, body: 'BrandingInput' }),
    },
    '/admin/marketing': {
      get: operation('Marketing', 'Consultar rastreamento e robots', { auth: true, admin: true }),
      put: operation('Marketing', 'Atualizar rastreamento e robots', { auth: true, admin: true, body: 'MarketingInput' }),
    },
    '/admin/dashboard/metrics': { get: operation('Administração', 'Consultar métricas do dashboard', { auth: true, admin: true }) },
    '/admin/reviews': { get: operation('Administração', 'Listar avaliações para moderação', { auth: true, admin: true, parameters: pagination }) },
    '/admin/reviews/{id}': {
      patch: operation('Administração', 'Moderar avaliação', { auth: true, admin: true, body: 'ReviewModerationInput', parameters: [id()] }),
      delete: operation('Administração', 'Excluir avaliação', { auth: true, admin: true, parameters: [id()] }),
    },
    '/admin/settings': {
      get: operation('Administração', 'Consultar configurações da loja', { auth: true, admin: true }),
      put: operation('Administração', 'Atualizar configurações da loja', { auth: true, admin: true, body: 'SettingsInput' }),
    },
    '/admin/integrations': { get: operation('Administração', 'Listar integrações configuradas', { auth: true, admin: true }) },
    '/admin/integrations/{kind}/{provider}': {
      put: operation('Administração', 'Configurar provedor de pagamento ou frete', { auth: true, admin: true, body: 'IntegrationInput', parameters: [
        { name: 'kind', in: 'path', required: true, schema: { enum: ['payment', 'shipping'] } },
        { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
      ] }),
    },
    '/admin/inventory/api-keys': {
      get: operation('Administração', 'Listar chaves de integração de estoque', { auth: true, admin: true }),
      post: operation('Administração', 'Emitir chave de integração de estoque', { auth: true, admin: true, body: 'InventoryKeyInput', success: '201' }),
    },
    '/integrations/inventory/sync': { post: operation('Administração', 'Sincronizar estoque em lote; requer X-API-Key e Idempotency-Key', { body: 'InventorySyncInput' }) },
    '/admin/integrations/{provider}': { delete: operation('Integrações', 'Remover configuração de provedor', { auth: true, admin: true, parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }] }) },
    '/admin/inventory/api-keys/{id}': { patch: operation('Integrações', 'Ativar ou revogar chave de estoque', { auth: true, admin: true, body: 'InventoryKeyStatusInput', parameters: [id()] }) },
    '/admin/webhooks/events': { get: operation('Webhooks', 'Listar eventos suportados', { auth: true, admin: true }) },
    '/admin/webhooks': {
      get: operation('Webhooks', 'Listar endpoints', { auth: true, admin: true }),
      post: operation('Webhooks', 'Criar endpoint e segredo', { auth: true, admin: true, body: 'WebhookInput', success: '201' }),
    },
    '/admin/webhooks/{id}': {
      put: operation('Webhooks', 'Atualizar endpoint', { auth: true, admin: true, body: 'WebhookInput', parameters: [id()] }),
      delete: operation('Webhooks', 'Excluir endpoint', { auth: true, admin: true, parameters: [id()] }),
    },
    '/admin/webhooks/{id}/rotate-secret': { post: operation('Webhooks', 'Rotacionar segredo', { auth: true, admin: true, parameters: [id()] }) },
    '/admin/webhooks/{id}/deliveries': { get: operation('Webhooks', 'Listar entregas do endpoint', { auth: true, admin: true, parameters: [id(), { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }] }) },
    '/admin/webhooks/{id}/test': { post: operation('Webhooks', 'Enfileirar entrega de teste', { auth: true, admin: true, success: '202', parameters: [id()] }) },
    '/admin/webhook-deliveries/{id}/retry': { post: operation('Webhooks', 'Reenfileirar entrega com falha', { auth: true, admin: true, success: '202', parameters: [id()] }) },
    '/admin/reports/sales': { get: operation('Administração', 'Consultar relatório de vendas', { auth: true, admin: true, parameters: [
      { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } },
    ] }) },
    '/admin/coupons': {
      get: operation('Administração', 'Listar cupons', { auth: true, admin: true }),
      post: operation('Administração', 'Cadastrar cupom', { auth: true, admin: true, body: 'CouponInput', success: '201' }),
    },
    '/admin/coupons/{id}': {
      put: operation('Administração', 'Atualizar cupom', { auth: true, admin: true, body: 'CouponInput', parameters: [id()] }),
      delete: operation('Administração', 'Excluir cupom', { auth: true, admin: true, parameters: [id()] }),
    },
    '/admin/orders': { get: operation('Administração', 'Listar pedidos', { auth: true, admin: true, parameters: pagination }) },
    '/admin/orders/{id}': { get: operation('Administração', 'Consultar pedido', { auth: true, admin: true, parameters: [id()] }) },
    '/admin/orders/{id}/status': { put: operation('Administração', 'Atualizar status do pedido', { auth: true, admin: true, body: 'OrderStatusInput', parameters: [id()] }) },
    '/admin/customers': { get: operation('Administração', 'Listar clientes', { auth: true, admin: true, parameters: pagination }) },
    '/admin/customers/{id}': {
      get: operation('Administração', 'Consultar cliente', { auth: true, admin: true, parameters: [id()] }),
      put: operation('Administração', 'Atualizar cliente', { auth: true, admin: true, body: 'ProfileInput', parameters: [id()] }),
    },
    '/admin/shipping_tracking': {
      get: operation('Administração', 'Listar rastreamentos', { auth: true, admin: true }),
      post: operation('Administração', 'Cadastrar rastreamento', { auth: true, admin: true, body: 'TrackingInput', success: '201' }),
    },
    '/admin/shipping_tracking/{id}': {
      put: operation('Administração', 'Atualizar rastreamento', { auth: true, admin: true, body: 'TrackingInput', parameters: [id()] }),
      delete: operation('Administração', 'Excluir rastreamento', { auth: true, admin: true, parameters: [id()] }),
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      RegisterInput: { type: 'object', required: ['nome', 'email', 'senha'], properties: { nome: { type: 'string' }, email: { type: 'string', format: 'email' }, senha: { type: 'string', minLength: 6, format: 'password' } } },
      LoginInput: { type: 'object', required: ['email', 'senha'], properties: { email: { type: 'string', format: 'email' }, senha: { type: 'string', format: 'password' } } },
      PasswordForgotInput: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      PasswordResetInput: { type: 'object', required: ['token', 'senha'], properties: { token: { type: 'string', minLength: 32 }, senha: { type: 'string', minLength: 12, format: 'password' } } },
      ProfileInput: { type: 'object', properties: { nome: { type: 'string' }, email: { type: 'string', format: 'email' }, endereco: { type: 'string' } } },
      ProductInput: { type: 'object', required: ['nome', 'preco', 'estoque'], properties: { nome: { type: 'string' }, descricao: { type: 'string' }, preco: { type: 'number', minimum: 0 }, estoque: { type: 'integer', minimum: 0 }, sku: { type: ['string','null'], maxLength: 80 }, peso_kg: { type: 'number', exclusiveMinimum: 0 }, altura_cm: { type: 'number', exclusiveMinimum: 0 }, largura_cm: { type: 'number', exclusiveMinimum: 0 }, comprimento_cm: { type: 'number', exclusiveMinimum: 0 }, categoria_id: { type: ['integer', 'null'] }, fotos_produto: { type: 'array', items: { type: 'string' } }, atributos_dinamicos: { type: 'object', additionalProperties: true }, foto_exibicao_fit: { enum: ['cover', 'contain'] }, foto_exibicao_position: { type: 'string' } } },
      CategoryInput: { type: 'object', required: ['nome'], properties: { nome: { type: 'string' }, descricao: { type: 'string' }, parent_id: { type: ['integer', 'null'] } } },
      CartItemInput: { type: 'object', required: ['produto_id', 'quantidade'], properties: { produto_id: { type: 'integer' }, quantidade: { type: 'integer', minimum: 1 } } },
      QuantityInput: { type: 'object', required: ['quantidade'], properties: { quantidade: { type: 'integer', minimum: 1 } } },
      ProductReference: { type: 'object', required: ['produto_id'], properties: { produto_id: { type: 'integer' } } },
      ReviewInput: { type: 'object', required: ['produto_id', 'nota', 'comentario'], properties: { produto_id: { type: 'integer' }, nota: { type: 'integer', minimum: 1, maximum: 5 }, comentario: { type: 'string' } } },
      CheckoutInput: { type: 'object', required: ['payment_method'], properties: { address_id: { type: 'integer' }, shipping_address_text: { type: 'string' }, shipping_method: { enum: ['standard', 'express', 'pickup'] }, shipping_quote_id: { type: 'string', format: 'uuid' }, payment_provider: { enum: ['sandbox','stripe'], description: 'sandbox somente fora de produção' }, payment_method: { enum: ['pix', 'card', 'boleto'], description: 'stripe aceita somente card' }, coupon_code: { type: 'string' } } },
      ShippingQuoteInput: { type: 'object', required: ['destination_zip'], properties: { destination_zip: { type: 'string', pattern: '^\\d{5}-?\\d{3}$' } } },
      IntegrationInput: { type: 'object', required: ['settings'], properties: { active: { type: 'boolean' }, settings: { type: 'object', description: 'Credenciais devem ser nomes de variaveis de ambiente em campos terminados por _env.' } } },
      InventoryKeyInput: { type: 'object', required: ['name'], properties: { name: { type: 'string', maxLength: 120 } } },
      InventorySyncInput: { type: 'object', required: ['items'], properties: { mode: { enum: ['set','increment'], default: 'set' }, items: { type: 'array', minItems: 1, maxItems: 1000, items: { type: 'object', required: ['quantity'], properties: { id: { type: 'integer' }, sku: { type: 'string' }, quantity: { type: 'integer' } } } } } },
      OrderInput: { type: 'object', required: ['checkout_session_id'], properties: { checkout_session_id: { type: 'integer' }, payment_reference: { type: 'string' } } },
      AddressInput: { type: 'object', required: ['label', 'recipient_name', 'street', 'city', 'state', 'zip_code'], properties: { label: { type: 'string' }, recipient_name: { type: 'string' }, street: { type: 'string' }, number: { type: 'string' }, complement: { type: 'string' }, neighborhood: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, zip_code: { type: 'string' }, is_default: { type: 'boolean' } } },
      CouponValidationInput: { type: 'object', required: ['code', 'subtotal'], properties: { code: { type: 'string' }, subtotal: { type: 'number', minimum: 0 } } },
      CouponInput: { type: 'object', required: ['code', 'discount_type', 'discount_value'], properties: { code: { type: 'string' }, description: { type: 'string' }, discount_type: { enum: ['percent', 'fixed'] }, discount_value: { type: 'number' }, min_order_value: { type: 'number' }, usage_limit: { type: ['integer', 'null'] }, active: { type: 'boolean' }, starts_at: { type: ['string', 'null'], format: 'date-time' }, ends_at: { type: ['string', 'null'], format: 'date-time' } } },
      ReviewModerationInput: { type: 'object', required: ['moderation_status'], properties: { moderation_status: { enum: ['approved', 'rejected'] } } },
      SettingsInput: { type: 'object', additionalProperties: true },
      BrandingInput: { type: 'object', required: ['branding'], properties: { branding: { type: 'object', required: ['store_name', 'colors', 'font', 'border_radius'], additionalProperties: true }, domains: { type: 'array', maxItems: 20, items: { type: 'string', format: 'hostname' } } } },
      MarketingInput: { type: 'object', properties: { gtm_id: { type: 'string', pattern: '^GTM-[A-Z0-9]+$' }, meta_pixel_id: { type: 'string', pattern: '^\\d{5,20}$' }, robots_disallow: { type: 'array', items: { type: 'string' } } } },
      WebhookInput: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string', format: 'uri' }, description: { type: 'string', maxLength: 180 }, events: { type: 'array', minItems: 1, items: { enum: ['order.created', 'payment.confirmed'] } }, active: { type: 'boolean' } } },
      InventoryKeyStatusInput: { type: 'object', required: ['active'], properties: { active: { type: 'boolean' } } },
      OrderStatusInput: { type: 'object', required: ['status'], properties: { status: { type: 'string' }, notes: { type: 'string' } } },
      TrackingInput: { type: 'object', required: ['order_id'], properties: { order_id: { type: 'integer' }, carrier: { type: 'string' }, tracking_code: { type: 'string' }, status: { type: 'string' }, checkpoints: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
    },
  },
};

module.exports = openapi;
