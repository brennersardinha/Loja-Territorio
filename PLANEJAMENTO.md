# Planejamento — Loja online própria (loja única)

Origem: `C:\Users\User\ecommerce\e-commerce` (plataforma multi-loja, branch `develop`).
Destino: `C:\Users\User\ecommerce\loja-online` (será publicado em um repositório separado).

## 1. Objetivo

Extrair da plataforma apenas o necessário para operar **uma única loja online** vinculada à loja física:
vitrine, conta do cliente, carrinho, checkout, pedidos e o painel administrativo do lojista.
Tudo que existe para vender/gerenciar lojas para terceiros (console da plataforma, planos, cobrança,
domínios customizados, provisionamento) fica de fora.

## 2. Estratégia técnica: "tenant fixo"

O backend usa `tenant_id` em 259 pontos de rotas/serviços. Remover isso exigiria reescrever praticamente
todas as consultas e aumentaria muito o risco de regressão.

**Decisão recomendada:** manter a coluna `tenant_id` no banco e no código, mas existir apenas um tenant
(`slug = 'default'`). O resolvedor de tenant passa a carregar sempre essa loja, sem depender de hostname,
subdomínio ou tabela de domínios. Assim o código de negócio continua idêntico ao testado na plataforma.

Uma remoção completa do `tenant_id` pode ser feita depois, como refatoração separada, se fizer sentido.

## 3. O que entra / o que sai

### Frontend (`frontend/` → `loja-online/frontend/`)

| Mantém | Remove |
|---|---|
| Home, busca, página de produto, carrinho, checkout, desejos | `/admin/dominios` (DomainsSection) |
| Conta do cliente (pedidos, endereços, perfil) | `/admin/plano` (BillingSection) |
| Login, cadastro, recuperação de senha | OnboardingProgress (onboarding de lojista da plataforma) |
| Admin: dashboard, pedidos, clientes, produtos, categorias | Seleção de loja/tenant no login |
| Admin: moderação de avaliações, identidade visual (branding) | `utils/tenantUrl.js` e referências a subdomínios |
| Admin: integrações (somente Stripe e Melhor Envio) | Páginas institucionais e blog (`ContentPublic`, `ContentAdminSection`, `RichTextEditor`) |
| Analytics GA4 com consentimento, SEO | Gestão de equipe (`TeamSection`, `AdminRoles`) |

### Backend (`backend/` → `loja-online/backend/`)

| Mantém | Remove |
|---|---|
| Rotas: users, products, categories, cart, wishlist, reviews, admin, checkout/pedidos/endereços/cupons (`sprint6`), branding, integration, seo | `console*.routes`, `console-auth` middleware |
| Serviços: payment (adaptadores `stripe` e `sandbox`), shipping (adaptador `melhor_envio`), mfa (se usado no admin) | `billing.routes`, `billing.service`, `plan-limit` middleware |
| Middleware: security, cors, tenant (simplificado), rate limit | `domain.routes`, `domain-provisioning.service`, `custom-hostname-provider` |
| Memberships: apenas o dono da loja (sem convites/edição de equipe) | `tenant-resolution.service` (cache por hostname) |
| `inventory.routes` e `webhook.routes` — base de integração do futuro sistema de estoque (ver seção 8) | `content.routes` (páginas e blog), `membership.routes` (gestão de equipe) |
| Health checks (`/health/live`, `/health/ready`) | Workers (`domain-provisioning`, `queue`) e infraestrutura Redis/BullMQ/S3 |
| | Adaptadores de pagamento Mercado Pago e PayPal; frete Correios |
| | Dependências: `@aws-sdk/*`, `bullmq`, `ioredis` (e `@sentry/node` se não for usado) |
| | Scripts de carga multi-tenant, seed de staging com 3 lojas |

### Infraestrutura e documentação

| Mantém | Remove |
|---|---|
| `docker-compose.yml` (PostgreSQL de desenvolvimento) | `console-frontend/` inteiro |
| Dockerfiles do backend e do frontend, `nginx.conf` | Workflows `console-*`, deploy da plataforma |
| CI simplificado (testes + build + `npm audit`) | `monitoring/` Prometheus/Grafana *(opcional, ver D5)* |
| README novo, focado na loja | `docs/` da plataforma (console, tenancy, comercial, cronogramas) |

## 4. Banco de dados e dados básicos

1. **Schema consolidado:** em vez de copiar as 23 migrations (a maioria cria tabelas do console, planos e
   cobrança), gerar uma migration base única `001_schema_inicial.js` contendo só as tabelas da loja:
   `tenants` (1 registro), `users`, `memberships`, `auth_sessions`, `audit_logs`, `tenant_password_resets`,
   `categories`, `products`, `carts`, `cart_items`, `wishlist_items`, `product_reviews`, `addresses`,
   `coupons`, `checkout_sessions`, `orders`, `order_items`, `order_status_history`, `shipping_tracking`,
   `shipping_quotes`, `store_settings`, `tenant_branding`, `tenant_marketing_settings`,
   `integration_settings`, `notifications`, `inventory_api_keys`, `inventory_sync_requests`,
   `webhook_endpoints`, `webhook_deliveries`. Sem `content_pages` e `blog_*`.
   O schema será extraído de um banco real migrado pela plataforma (via `pg_dump --schema-only`) para garantir
   que constraints, índices e triggers (ex.: imutabilidade de snapshot de pedido) fiquem idênticos.
2. **Seed de dados básicos** (`npm run seed`), idempotente:
   - a loja (tenant `default`) com nome, moeda BRL e fuso `America/Sao_Paulo`;
   - `store_settings` padrão e branding inicial;
   - usuário administrador (dono) com e-mail/senha vindos de variáveis de ambiente;
   - pagamento `sandbox` para testes; integrações `stripe` e `melhor_envio` cadastradas como inativas,
     apontando para as variáveis `STRIPE_SECRET_KEY` e `MELHOR_ENVIO_TOKEN`;
   - categorias e produtos de exemplo opcionais (`SEED_DEMO=true`).
3. **Sem dados reais da plataforma:** nenhum cliente, pedido ou senha do banco atual será copiado.

## 5. Etapas

| # | Etapa | Entrega |
|---|---|---|
| 1 | Estrutura e planejamento | Esta pasta e este documento |
| 2 | Cópia do código | `backend/` e `frontend/` copiados sem `node_modules`, `dist`, `.env` |
| 3 | Poda do backend | Rotas, serviços, middlewares e dependências removidos; `index.js` e `routes/index.js` limpos |
| 4 | Tenant fixo | Resolvedor carrega sempre a loja `default`; remoção de bloqueios por plano/status de cobrança |
| 5 | Banco | Migration base consolidada + seed de dados básicos |
| 6 | Poda do frontend | Rotas/telas da plataforma removidas; menu do admin ajustado |
| 7 | Testes | Remover testes de console/billing/domínios; manter e adaptar os de catálogo, carrinho, checkout, auth, admin, SEO; adicionar teste do tenant fixo |
| 8 | Infra e docs | `docker-compose.yml`, `.env.example`, CI enxuto, README de instalação e operação |
| 9 | Validação final | `npm ci`, migração em banco limpo, seed, testes backend/frontend, build, `npm audit`, fluxo manual: cadastro → carrinho → checkout sandbox → pedido no admin |

## 6. Critérios de aceite ("íntegra e funcional")

- Banco vazio → `npm run migrate` → `npm run seed` sobe sem erro.
- Backend e frontend iniciam localmente e o fluxo completo de compra funciona com pagamento sandbox.
- Painel admin permite cadastrar produto/categoria, ver e atualizar pedidos.
- Todos os testes mantidos passam; `npm audit --omit=dev --audit-level=high` sem falhas.
- Nenhuma referência restante a console, planos, cobrança, domínios customizados, blog, páginas
  institucionais ou gestão de equipe (verificado por busca).
- Nenhum segredo, `.env` ou dado real copiado.

## 7. Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Manter `tenant_id` com loja fixa ou remover totalmente? | Manter com loja fixa (seção 2) |
| D2 | Páginas institucionais e blog? | Remover |
| D3 | Gestão de equipe/papéis no admin? | Remover; apenas o dono acessa o painel |
| D4 | Sincronização de estoque e webhooks? | Manter a API existente, desativada até o sistema de estoque existir; especificação em [ESPECIFICACAO-ESTOQUE.md](ESPECIFICACAO-ESTOQUE.md) |
| D5 | Prometheus/Grafana? | Remover; apenas health checks |
| D6 | Pagamento e frete? | Stripe e Melhor Envio (sandbox mantido só para testes locais) |
| D7 | Retirada na loja física? | Adicionar depois que a cópia estiver validada (etapa futura, fora deste escopo) |

## 8. Integração com o futuro sistema de estoque

A loja física ainda não possui sistema de estoque. A loja online mantém a API de sincronização e os
webhooks de pedido já existentes na plataforma, sem chaves nem endpoints cadastrados (portanto inativos).
O contrato, os fluxos e as lacunas a resolver estão em [ESPECIFICACAO-ESTOQUE.md](ESPECIFICACAO-ESTOQUE.md).

## 9. Status de execução (2026-10-28)

Etapas 1 a 9 concluídas.

| Verificação | Resultado |
|---|---|
| Migration em banco vazio (aplicada duas vezes) + validação de tabelas, constraints, triggers e outbox | OK (`npm run test:migrations`) |
| Seed executado duas vezes (idempotente) | OK |
| Testes backend | 23 suítes, 122 testes OK |
| Testes frontend | 22 arquivos, 67 testes OK; build OK |
| `npm audit --omit=dev --audit-level=high` | OK nos dois projetos (restam 2 alertas moderados do `qs`, dependência do Express) |
| Imagens Docker e stack de produção (nginx + API + PostgreSQL) | OK: migrate, seed, vitrine, API, sitemap, robots e cabeçalhos de segurança |
| Fluxo via API: cadastro → carrinho → endereço → checkout sandbox com cupom → pedido → admin altera status | OK |
| Sandbox recusado em produção; provedores removidos recusados | OK |

### Ajustes de decisão durante a execução

- **Papéis:** apenas `owner` (dono → admin) e `customer`. Papéis de equipe foram removidos do schema e do RBAC.
- **Marketing:** a configuração de GTM, Meta Pixel e `robots.txt` estava no módulo de conteúdo (removido);
  foi extraída para `marketing.routes.js` e para a tela *Admin → Marketing*.
- **Status da loja:** a coluna `tenants.status` aceita apenas `active` (suspensão/cobrança não existem mais).
- **URL pública:** `STORE_PUBLIC_URL` passou a ser obrigatória em produção (links de e-mail, sitemap e robots).

### Defeitos herdados da plataforma e corrigidos na cópia

| Defeito | Impacto | Correção |
|---|---|---|
| Consulta do outbox de webhooks usava `$2` como `varchar` e `text` | **Todo pedido falhava com erro 500** ao finalizar | Cast explícito `$2::text` + teste contra banco real |
| Pagamento `sandbox` aceito em qualquer ambiente | Em produção, pedidos seriam marcados como pagos sem cobrança | Bloqueado com `NODE_ENV=production`; desligável com `PAYMENT_SANDBOX_ENABLED=false` |
| Tela de integrações salvava frete como `api_token_env`, serviço lia `token_env` | Melhor Envio nunca funcionaria pela tela | Chave corrigida para `token_env` |
| `add_header` nos `location` do nginx anulava os cabeçalhos do `server` | HTML servido sem CSP, `X-Frame-Options` e `nosniff` | Cabeçalhos em `security-headers.conf`, incluído em cada bloco |
| CSP bloqueava Google Fonts, GA4, GTM e Meta Pixel | Fontes e rastreamento não carregavam | Domínios específicos liberados |
| Nginx não encaminhava `/robots.txt` e `/sitemap.xml` | Ambos devolviam a página da vitrine | Encaminhados ao backend |
| Sitemap usava o cabeçalho `Host` do cliente | Possível envenenamento de cache/SEO | Usa `STORE_PUBLIC_URL` |
| Textos com acentuação corrompida na documentação OpenAPI | Documentação ilegível | Codificação corrigida |

### Pendências (resolvidas na etapa 10)

As quatro pendências acima foram concluídas; veja a seção 10.

## 10. Etapa 10 — itens restantes (2026-10-28)

| Item | Entrega |
|---|---|
| Pagamento Stripe na vitrine | Payment Element (Stripe.js oficial, carregado sob demanda) com autorização no checkout e captura só depois de gravar o pedido; falhas cancelam a autorização; retorno de 3DS conclui o pedido; valor autorizado conferido com o total; chave pública exposta só com a integração ativa |
| Retirada na loja (D7) | *Admin → Dados da loja*: endereço, horário e instruções. Checkout oferece "Retirar na loja (grátis)" sem exigir endereço; status "Pronto para retirada"/"Retirado" |
| Páginas legais | Políticas de trocas e privacidade em texto simples (`/politicas/trocas`, `/politicas/privacidade`) e contatos no rodapé, editados em *Admin → Dados da loja* (sem reintroduzir o CMS) |
| Integração de estoque L1–L7 | Cancelamento devolve estoque uma única vez e emite `order.cancelled`; SKU nos webhooks; consulta de saldo; tela *Admin → Estoque e webhooks*; SKU obrigatório com chave ativa |

Verificação: backend 27 suítes / 143 testes; frontend 23 arquivos / 71 testes; build OK; teste ponta a ponta
contra PostgreSQL real e uma simulação da API da Stripe (autorização, captura, cancelamento por falta de
estoque, retirada, cancelamento com devolução de estoque, consulta de saldo) e smoke original em banco limpo.

Defeito encontrado durante os testes e corrigido antes de entregar: repetir o status `cancelled` (permitido para
registrar observações) devolveria o estoque duas vezes.

### Pendências

- Testar com chaves reais de teste da Stripe (`sk_test_`/`pk_test_`) no navegador, incluindo cartão 3DS.
- Estorno de pedidos pagos cancelados é manual no painel da Stripe (decisão de negócio; automatizável).
- Revisão jurídica dos textos de políticas antes de publicar.
