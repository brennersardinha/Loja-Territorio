# Loja Online

Loja virtual própria da loja física: vitrine, conta do cliente, carrinho, lista de desejos, cupons,
checkout, pedidos, avaliações e painel administrativo do dono da loja.

Derivada da plataforma multi-loja original, mantendo apenas uma loja (veja [PLANEJAMENTO.md](PLANEJAMENTO.md)).

## Tecnologias

- Backend: Node.js 22, Express, PostgreSQL 15.
- Frontend: React 18, React Router e Vite.
- Produção: Docker Compose e Nginx.
- Testes: Jest, Supertest, Vitest e Testing Library.

## Desenvolvimento local

Requisitos: Node.js 22, Docker (para o PostgreSQL) e portas `4000`, `5173` e `5433` livres.

```powershell
# 1. Banco de dados (porta 5433 no host)
docker compose up -d

# 2. Backend
cd backend
npm ci
Copy-Item .env.example .env        # preencha SEED_ADMIN_PASSWORD (mínimo 12 caracteres)
npm run migrate
npm run seed                       # loja, administrador e integrações; SEED_DEMO=true cria produtos de exemplo
npm run dev                        # http://localhost:4000

# 3. Frontend (outro terminal)
cd frontend
npm ci
npm run dev                        # http://localhost:5173
```

Entre em `/conta` com `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` e acesse `/admin`.

Em desenvolvimento o checkout oferece **Ambiente de teste** (sandbox), que confirma o pedido sem cobrança.
Esse modo é sempre recusado pelo backend quando `NODE_ENV=production`.

## Scripts úteis (backend)

| Comando | O que faz |
|---|---|
| `npm run migrate` / `migrate:status` | Aplica / lista migrations |
| `npm run seed` | Dados básicos (idempotente) |
| `npm test` | Testes unitários |
| `npm run test:migrations` | Cria banco temporário, aplica migrations e valida schema, triggers e outbox de webhooks |
| `npm run test:load` | Carga simples no catálogo |

Documentação da API: `http://localhost:4000/api/docs` (OpenAPI em `/api/openapi.json`).

## Produção

```powershell
Copy-Item .env.production.example .env.production   # preencha todos os valores
docker compose -f docker-compose.production.yml --env-file .env.production up -d postgres
docker compose -f docker-compose.production.yml --env-file .env.production run --rm backend npm run migrate
docker compose -f docker-compose.production.yml --env-file .env.production run --rm backend npm run seed
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

O Nginx do frontend serve a vitrine, encaminha `/api`, `/robots.txt` e `/sitemap.xml` ao backend e aplica os
cabeçalhos de segurança (CSP, `X-Frame-Options`, `nosniff`). Coloque HTTPS na frente (proxy reverso ou CDN)
e informe a faixa de IPs desse proxy em `TRUSTED_PROXY_CIDRS`.

## Integrações

| Integração | Configuração |
|---|---|
| Stripe (cartão) | `STRIPE_SECRET_KEY` e `STRIPE_PUBLISHABLE_KEY` no ambiente; ativar em *Admin → Integrações* (variável `STRIPE_SECRET_KEY`) |
| Melhor Envio (frete) | `MELHOR_ENVIO_TOKEN` e `SHIPPING_ORIGIN_ZIP`; ativar em *Admin → Integrações* (variável `MELHOR_ENVIO_TOKEN`) |
| E-mail (recuperação de senha) | `RESEND_API_KEY` e `RESEND_FROM` |
| GA4 / GTM / Meta Pixel | `GA_MEASUREMENT_ID` no build; GTM e Pixel em *Admin → Marketing*. Carregados só após consentimento |
| Sistema de estoque | Chaves e webhooks em *Admin → Estoque e webhooks*. Contrato em [ESPECIFICACAO-ESTOQUE.md](ESPECIFICACAO-ESTOQUE.md) |

Credenciais nunca são gravadas no banco: as integrações guardam apenas o **nome** da variável de ambiente.

### Pagamento com Stripe

O cliente digita o cartão no formulário oficial da Stripe (Payment Element); os dados não passam pelo servidor.
O valor é **autorizado** no checkout e só é **capturado** depois que o pedido e a baixa de estoque são gravados.
Se o pedido não puder ser concluído (estoque esgotado, cupom esgotado, sessão expirada), a autorização é
cancelada e o cliente não é cobrado. Cancelar um pedido já pago no admin devolve o estoque, mas o **estorno é
feito no painel da Stripe** (o admin avisa).

Antes de vender, teste com as chaves `sk_test_`/`pk_test_` e o cartão `4242 4242 4242 4242`; para 3DS use
`4000 0025 0000 3155`.

## Dados da loja física

Em *Admin → Dados da loja*:

- **Retirada na loja:** endereço, horário e instruções. Quando ativa, o checkout oferece "Retirar na loja
  (grátis)" sem exigir endereço; o pedido mostra "Pronto para retirada" e "Retirado" no lugar de
  "Enviado" e "Entregue".
- **Atendimento:** e-mail, telefone e WhatsApp exibidos no rodapé.
- **Políticas:** trocas e devoluções e privacidade, publicadas em `/politicas/trocas` e
  `/politicas/privacidade` (texto simples, linkadas no rodapé). Preencha antes de começar a vender (CDC/LGPD).
