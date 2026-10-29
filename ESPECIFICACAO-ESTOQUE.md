# Especificação — Integração com o sistema de estoque da loja física

Status: **lado da loja online pronto** (lacunas L1–L7 implementadas em 2026-10-28). A loja física ainda não
possui sistema de estoque. Este documento define como o futuro sistema (chamado aqui de **Sistema de
Estoque**) deve se integrar à loja online.

## 1. Situação atual

- O estoque de cada produto fica em `products.estoque` (inteiro, nunca negativo) e o produto é
  identificado pelo `id` interno ou pelo `sku` (único por loja, comparação sem diferenciar maiúsculas).
- A loja online **baixa o estoque no momento em que o pedido é criado** (`POST /api/orders`), dentro da
  mesma transação, recusando a compra se não houver quantidade suficiente.
- **Cancelar um pedido no admin devolve o estoque** dos itens uma única vez (repetir o status não devolve de novo).
- Hoje o estoque é mantido manualmente pelo painel admin (cadastro/edição de produto).
- A loja online possui dois mecanismos de integração, **inativos** até existir uma chave ou endpoint
  cadastrado em *Admin → Estoque e webhooks*:
  1. **API de sincronização e consulta de estoque** — o Sistema de Estoque envia e confere quantidades.
  2. **Webhooks de pedido** — a loja online avisa o Sistema de Estoque sobre vendas e cancelamentos online.

## 2. Princípios

1. **Fonte da verdade:** o Sistema de Estoque é o dono do saldo físico. A loja online mantém uma cópia
   do saldo disponível para venda e informa cada venda online.
2. **SKU como chave de negócio:** todo produto vendido online deve ter `sku` igual ao código usado no
   Sistema de Estoque. O `id` interno da loja online não deve ser usado pelo Sistema de Estoque.
3. **Idempotência obrigatória:** toda escrita do Sistema de Estoque usa `Idempotency-Key`; todo webhook
   recebido deve ser deduplicado pelo `X-Webhook-Id`.
4. **Sem saldo negativo:** qualquer lote que deixaria um produto negativo é rejeitado por inteiro.

## 3. Fluxos

| # | Situação | Direção | Mecanismo |
|---|---|---|---|
| F1 | Carga inicial e inventário periódico | Estoque → Loja online | `POST /api/integrations/inventory/sync` com `mode: "set"` |
| F2 | Venda no balcão, perda, devolução ou entrada de mercadoria | Estoque → Loja online | `sync` com `mode: "increment"` (quantidade negativa para saída, positiva para entrada) |
| F3 | Venda online | Loja online → Estoque | Webhook `order.created` (estoque online já foi baixado) |
| F4 | Pagamento online confirmado | Loja online → Estoque | Webhook `payment.confirmed` |
| F5 | Cancelamento de pedido online | Loja online → Estoque | Webhook `order.cancelled` (estoque online já foi devolvido) |
| F6 | Conferência / reconciliação | Estoque ↔ Loja online | `GET /api/integrations/inventory` para comparar; divergências corrigidas com `mode: "set"` (F1) |

Para evitar conflito entre F2 e F3, o Sistema de Estoque **não deve** reenviar como `increment` as baixas
que ele recebeu via webhook `order.created` — elas já foram aplicadas na loja online. O mesmo vale para as
devoluções recebidas via `order.cancelled`.

## 4. Contrato — API de sincronização (Estoque → Loja online)

### 4.1 Chaves de acesso

Gerenciadas em *Admin → Estoque e webhooks* ou pela API administrativa (permissão `inventory_keys:manage`):

| Método | Caminho | Finalidade |
|---|---|---|
| GET | `/api/admin/inventory/api-keys` | Lista chaves (prefixo, ativa, último uso) |
| POST | `/api/admin/inventory/api-keys` | Cria chave `{ "name": "PDV loja centro" }`; o segredo `inv_...` aparece **uma única vez** |
| PATCH | `/api/admin/inventory/api-keys/:id` | Ativa/revoga `{ "active": false }` |

A chave é armazenada apenas como hash SHA-256. Deve ficar em cofre/variável de ambiente do Sistema de Estoque.
Enquanto houver uma chave ativa, a loja exige `sku` em todo produto criado ou editado.

### 4.2 Sincronização

```
POST /api/integrations/inventory/sync
X-API-Key: inv_xxxxxxxx
Idempotency-Key: 2026-10-28-inventario-001
Content-Type: application/json

{
  "mode": "increment",
  "items": [
    { "sku": "CAM-001", "quantity": -2 },
    { "sku": "CAL-042", "quantity": 10 }
  ]
}
```

| Regra | Valor |
|---|---|
| `mode` | `set` (define o saldo) ou `increment` (soma, aceita negativo); padrão `set` |
| Itens por lote | 1 a 1000; cada item exige `sku` (ou `id`) e `quantity` inteira |
| `mode: "set"` | `quantity` ≥ 0 |
| Transação | Lote inteiro aplicado ou nenhum item aplicado |
| `Idempotency-Key` | Até 100 caracteres, única por chave de API |

| Resposta | Significado | Ação do Sistema de Estoque |
|---|---|---|
| `200 { "updated": [{ "id", "sku", "estoque" }], "count" }` | Aplicado | Registrar saldo retornado |
| `200` (repetição) | Mesma chave + mesmo conteúdo: devolve a resposta original | Nenhuma |
| `400` | Lote inválido | Corrigir dados; não repetir igual |
| `401` / `403` | Chave ausente, inválida, revogada ou de outra loja | Alertar operador |
| `409` | Mesma `Idempotency-Key` com conteúdo diferente, ou lote ainda em processamento | Gerar nova chave só se o conteúdo mudou de fato |
| `422` | SKU inexistente ou saldo ficaria negativo | Corrigir cadastro/saldo; enviar novo lote |
| `5xx` / timeout | Falha temporária | Repetir com a **mesma** `Idempotency-Key` (backoff exponencial) |

### 4.3 Consulta de saldo (reconciliação)

```
GET /api/integrations/inventory?sku=CAM-001&page=1&limit=100
X-API-Key: inv_xxxxxxxx
```

Retorna `{ "items": [{ "id", "sku", "nome", "estoque" }], "pagination": { "page", "limit", "total_items" } }`.
Sem `sku`, lista todos os produtos (até 500 por página). Mesmos códigos `401`/`403` da sincronização.

## 5. Contrato — Webhooks (Loja online → Estoque)

Endpoints cadastrados em *Admin → Estoque e webhooks* (ou `/api/admin/webhooks`): URL HTTPS pública, eventos
assinados e segredo gerado pela loja, exibido uma única vez (rotacionável em
`POST /api/admin/webhooks/:id/rotate-secret`).

Entrega: `POST` JSON com cabeçalhos

| Cabeçalho | Conteúdo |
|---|---|
| `X-Webhook-Id` | ID único do evento (usar para deduplicar) |
| `X-Webhook-Event` | `order.created`, `order.cancelled` ou `payment.confirmed` |
| `X-Webhook-Timestamp` | Epoch em segundos |
| `X-Webhook-Signature` | `sha256=` + HMAC-SHA256 de `"{timestamp}.{corpo}"` com o segredo |

O receptor deve: validar a assinatura com comparação em tempo constante; rejeitar timestamps com mais de
5 minutos de diferença; responder `2xx` rapidamente e processar de forma assíncrona. Respostas fora de
`2xx` geram novas tentativas (padrão: até 6, configurável por `WEBHOOK_MAX_ATTEMPTS`).

Corpo de `order.created` (resumido):

```json
{
  "id": "uuid-do-evento",
  "type": "order.created",
  "created_at": "2026-10-28T14:00:00.000Z",
  "data": {
    "order": {
      "id": 123,
      "status": "paid",
      "total": "199.90",
      "items": [
        { "produto_id": 45, "sku": "CAM-001", "nome_produto": "Camiseta", "quantidade": 2, "preco_unitario": "59.90" }
      ]
    }
  }
}
```

Corpo de `order.cancelled` (itens cujo estoque foi devolvido na loja online):

```json
{
  "id": "uuid-do-evento",
  "type": "order.cancelled",
  "created_at": "2026-10-29T10:00:00.000Z",
  "data": {
    "order": {
      "id": 123,
      "reason": "Cliente desistiu",
      "items": [{ "produto_id": 45, "sku": "CAM-001", "quantidade": 2 }]
    }
  }
}
```

## 6. Lacunas (implementadas)

| # | Lacuna | Implementação |
|---|---|---|
| L1 | Cancelar pedido não devolvia o estoque online | Transição para `cancelled` devolve as quantidades de `order_items` na mesma transação, uma única vez |
| L2 | Não existia evento de cancelamento | Evento `order.cancelled` com os itens devolvidos |
| L3 | Webhook trazia `produto_id`, mas não `sku` | `sku` incluído em cada item de `order.created` e `order.cancelled` |
| L4 | Não havia consulta de saldo | `GET /api/integrations/inventory` (seção 4.3) |
| L5 | Chaves e webhooks só via API | Tela *Admin → Estoque e webhooks* |
| L6 | Produtos sem SKU não sincronizam | Com chave ativa, `sku` obrigatório ao criar/editar produto |
| L7 | Baixa de estoque com pagamento não concluído | Com Stripe o cartão é só autorizado; o pedido (e a baixa) é gravado antes da captura, e falhas cancelam a autorização. Checkout abandonado não reserva estoque |

## 7. Requisitos não funcionais

- Comunicação somente por HTTPS; chave de API e segredo de webhook nunca em código ou logs.
- Lotes de inventário completo (F1) fora do horário de pico, em blocos de até 1000 itens.
- Logs no Sistema de Estoque com `Idempotency-Key`, `X-Webhook-Id`, SKU e resultado, para auditoria.
- Testes de contrato cobrindo: lote válido, repetição idempotente, conflito `409`, saldo negativo `422`,
  assinatura de webhook inválida e entrega duplicada.

## 8. Ativação

1. Garantir que todos os produtos vendidos online tenham `sku` igual ao do Sistema de Estoque.
2. Criar a chave de API e o endpoint de webhook em homologação (*Admin → Estoque e webhooks*); executar a carga inicial (F1).
3. Validar F2–F5 com pedidos de teste; conferir saldos com a reconciliação (F6).
4. Repetir em produção e desativar a edição manual de estoque no painel, se desejado.
