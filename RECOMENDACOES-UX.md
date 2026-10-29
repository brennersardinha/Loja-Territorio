# Recomendações de UX e conversão — vitrine

Avaliação feita em 2026-10-28 navegando pela loja (desktop 1366 px e celular 390 px) com catálogo de exemplo.
Objetivo: deixar a loja mais intuitiva e aumentar a taxa de compra.

Legenda — **Impacto:** Alto / Médio / Baixo · **Esforço:** P (até meio dia) / M (1–2 dias) / G (3+ dias).
Caminhos de arquivo relativos a `frontend/src/` (e `backend/src/` quando indicado).

## Resumo

| # | Recomendação | Impacto | Esforço | Rodada |
|---|---|---|---|---|
| 1 | Aceitar Pix | Alto | M–G | 2 |
| 2 | Comprar sem criar conta (ou cadastro dentro do checkout) | Alto | G | 1 |
| 3 | Simplificar a etapa de entrega | Alto | M | 1 |
| 4 | Destacar retirada grátis e frete na página do produto | Alto | M | 1 |
| 5 | Esconder estrelas quando não há avaliações | Médio | P | 1 |
| 6 | Home com banner, textos e coleções editáveis | Médio | M | 1 |
| 7 | Navegação: busca no cabeçalho, sem links duplicados, ícones com texto | Médio | P–M | 1 |
| 8 | Acabamento: código interno, fonte do preço, acentos, botões | Médio | P | 1 |
| 9 | Parcelamento, relacionados, galeria, WhatsApp, cupom no carrinho | Médio | M–G | 2 |
| 10 | Falhas visuais menores (skip link, 404) | Baixo | P | 1 |

Ordem sugerida: **rodada 1** (itens 2–8 e 10) remove atrito e é independente de decisões externas;
**rodada 2** (itens 1 e 9) depende da escolha do meio de pagamento.

---

## 1. Aceitar Pix

- **Problema:** a vitrine só aceita cartão (Stripe com `payment_method_types=card`). Pix é o meio de
  pagamento online mais usado no Brasil; sem ele, parte relevante dos clientes abandona no pagamento.
- **Decisão necessária:** Pix pela Stripe (exige conta Stripe Brasil elegível ao Pix) **ou** voltar a usar
  o Mercado Pago (Pix, cartão e boleto, muito difundido no Brasil; o adaptador existia na plataforma de origem).
- **Onde:** `backend/src/services/payment.service.js`, `backend/src/routes/sprint6.routes.js`
  (`providerMethods`), `components/CheckoutSection.jsx`, `components/StripePaymentForm.jsx`.
- **Cuidados:** Pix é assíncrono (QR code + confirmação posterior). Será preciso pedido em `pending`, tela com
  QR code/copia-e-cola, confirmação por webhook do provedor e expiração; hoje o pedido é gravado já como `paid`.
- **Aceite:** cliente escolhe Pix, vê o QR code, paga e o pedido muda para "Pagamento confirmado" sem ação manual;
  Pix expirado libera o carrinho e não baixa estoque.

## 2. Comprar sem criar conta

- **Problema:** `/checkout` exige login antes de qualquer etapa ("Entre para finalizar sua compra"). Cadastro
  obrigatório é uma das principais causas de abandono.
- **Recomendação (escolher uma):**
  - *Compra como convidado:* e-mail + dados de entrega no próprio checkout; oferecer criar senha depois da compra.
  - *Cadastro embutido:* nome, e-mail e senha como primeira etapa do checkout, sem sair da página.
- **Onde:** `components/CheckoutSection.jsx` (bloqueio em `if (!token)`), `hooks/useCheckout.js`;
  backend: carrinho e checkout hoje dependem de `authenticateToken` (`routes/cart.routes.js`, `routes/sprint6.routes.js`).
- **Cuidados:** o carrinho de visitante precisa existir (hoje só há carrinho autenticado); acompanhar pedido de
  convidado por link no e-mail.
- **Aceite:** visitante adiciona produto e conclui a compra sem passar por `/conta`.

## 3. Simplificar a etapa de entrega

- **Problemas observados:**
  - Seletor "Padrão / Expresso" com preços fixos convive com um botão separado "Calcular frete pelo CEP".
  - O seletor não mostra preço nem prazo de cada opção.
  - O resumo exibe "Frete R$ 0,00" antes de qualquer cálculo (parece frete grátis).
  - A retirada na loja só aparece **depois** de o cliente preencher endereço.
  - Endereço tem dois caminhos confusos: "Endereço salvo" (select) e "Endereço alternativo" (texto livre).
- **Recomendação:**
  - Primeira pergunta do checkout: **"Receber em casa"** ou **"Retirar na loja — grátis"** (cartões grandes).
  - Retirada: pula a etapa de endereço e mostra endereço/horário da loja.
  - Entrega: CEP primeiro, busca automática das opções do Melhor Envio, lista em cartões com preço e prazo;
    remover os métodos fixos "Padrão/Expresso" quando a integração estiver ativa.
  - Resumo mostra "Frete: a calcular" até haver uma opção escolhida.
  - Endereço com formulário estruturado (CEP com preenchimento automático), sem o campo de texto livre.
- **Onde:** `components/CheckoutSection.jsx`, `hooks/useCheckout.js`, `backend/src/routes/sprint6.routes.js`
  (`shippingMethods`), `backend/src/routes/integration.routes.js` (`/shipping/quotes`).
- **Aceite:** comprar com retirada em no máximo 3 cliques após o carrinho; nenhum valor de frete aparece antes
  de ser calculado.

## 4. Retirada grátis e frete na página do produto

- **Problema:** a página do produto diz apenas "O prazo e o valor do frete são calculados no checkout".
  A retirada grátis na loja física — principal diferencial — não aparece.
- **Recomendação:**
  - Selo "Retire grátis na loja · {endereço resumido}" quando a retirada estiver ativa.
  - Campo "Calcular frete" com CEP direto na página do produto.
  - Repetir o selo de retirada nos cartões de produto e no carrinho.
- **Onde:** `components/StoreSection.jsx` (bloco `delivery-note`, ~linha 117), `components/ui/ProductCard.jsx`,
  `components/CartSection.jsx`; dados em `hooks/useStoreInfo.js`.
- **Cuidados:** a cotação atual exige login e usa o carrinho; criar cotação por produto/CEP para visitantes.
- **Aceite:** visitante vê opção de retirada e preço do frete sem entrar no checkout.

## 5. Esconder estrelas sem avaliações

- **Problema:** todos os produtos mostram ☆☆☆☆☆ "Sem avaliações" — prova social negativa. Na página do produto
  aparece "★ — Sem avaliações".
- **Recomendação:** sem avaliações aprovadas, não exibir estrelas; na página do produto, mostrar apenas
  "Seja o primeiro a avaliar" no bloco de avaliações.
- **Onde:** `components/ui/ProductCard.jsx`, `components/StoreSection.jsx`, `components/ProductReviews.jsx`.
- **Aceite:** produto sem avaliação não exibe estrelas em nenhuma tela.

## 6. Home editável e com cara da loja

- **Problema:** título "Explore nossos produtos", destaque "Do catálogo até sua casa" e um círculo azul
  decorativo — textos genéricos que não falam da loja. Cartões de categoria sem imagem.
- **Recomendação:**
  - Banner principal com imagem, título, subtítulo e botão configuráveis em *Admin → Identidade visual*
    (o branding já tem `banners` e `texts.welcome`; estender para título/subtítulo/CTA).
  - Seções configuráveis: "Novidades", "Mais vendidos", "Ofertas" (por categoria ou seleção manual).
  - Imagem por categoria.
  - Faixa "Retire grátis na loja" e "Atendimento pelo WhatsApp" logo abaixo do banner.
- **Onde:** `components/HomeSection.jsx`, `components/BrandingSection.jsx`, `contexts/BrandingContext.jsx`,
  `config/uiCopy.js`; backend `routes/branding.routes.js` (validação) e `routes/category.routes.js` (imagem).
- **Aceite:** lojista troca banner e textos da home pelo admin, sem deploy.

## 7. Navegação

- **Problemas:**
  - Links duplicados: menu (Carrinho, Desejos, Conta, **Checkout**) repete os ícones do topo; "Checkout" no menu
    leva a uma página vazia/bloqueada.
  - Sem campo de busca no cabeçalho (só em `/buscar`).
  - No celular os ícones do topo aparecem sem texto e o do carrinho é "▣", pouco reconhecível.
- **Recomendação:**
  - Menu principal: Início, Produtos e categorias principais. Remover Carrinho/Desejos/Conta/Checkout do menu.
  - Busca no cabeçalho (ícone que expande no celular).
  - Ícones reconhecíveis (sacola/carrinho, coração, pessoa) com rótulo curto ou `aria-label`, e contador do
    carrinho visível também no celular.
- **Onde:** `layouts/ClientLayout.jsx` (`clientNavigation`, `header-actions`), `App.css`.
- **Aceite:** no celular, o carrinho é identificável e mostra a quantidade; busca disponível em todas as páginas.

## 8. Acabamento e textos

| Problema | Onde | Ajuste |
|---|---|---|
| Código interno ("BOL349") no topo da página do produto | `components/StoreSection.jsx` | Mover para "Detalhes do produto" (texto pequeno) ou ocultar |
| Preço em fonte monoespaçada (`technical-data`) parece dado técnico | `ProductCard.jsx`, `StoreSection.jsx`, `CartItemCard.jsx`, `App.css` | Usar a fonte principal em peso forte |
| Textos sem acento: "Avaliacoes", "Este produto ainda nao possui avaliacoes", mensagens da API ("estoque disponivel", "Retirada na loja indisponivel", "Nao foi possivel…") | `components/ProductReviews.jsx`, `config/uiCopy.js`, mensagens em `backend/src/routes/*.js` e `services/*.js` | Revisar ortografia de todo texto exibido ao cliente |
| "Remover" vermelho e chamativo no carrinho | `components/ui/CartItemCard.jsx` | Botão discreto (texto/ícone de lixeira) |
| Dois botões empilhados no cartão ("Adicionar ao carrinho" + "Ver detalhes") | `components/ui/ProductCard.jsx` | Cartão inteiro clicável para detalhes; manter só "Adicionar" |
| Rótulo de categoria em todos os cartões ("MAIS VENDIDOS") parece selo promocional | `components/ui/ProductCard.jsx` | Exibir categoria discreta ou usar selos reais (Novo, Oferta, Últimas unidades) |
| Placeholder "Imagem indisponível para {produto}" | `components/ui/ResponsiveImage.jsx` | Ilustração neutra com o logo da loja; exigir ao menos uma foto para publicar |

## 9. Recursos que aumentam o valor da compra

| Recurso | Observação |
|---|---|
| Parcelamento ("em até 3x sem juros") no cartão e na página do produto | Requer configuração de parcelas no provedor (Stripe Brasil ou Mercado Pago) |
| Produtos relacionados / "Complete o visual" na página do produto e no carrinho | Por categoria, inicialmente |
| Galeria com várias fotos e zoom | O produto já aceita várias fotos (`fotos_produto`); falta a galeria com miniaturas |
| Botão flutuante de WhatsApp | Usar `contact.whatsapp` de *Admin → Dados da loja* (`hooks/useStoreInfo.js`) |
| Campo de cupom no carrinho | Hoje só no checkout; endpoint `/api/coupons/validate` já existe |
| Frete grátis acima de um valor, com barra de progresso no carrinho | Regra nova no backend de checkout |
| Recuperação de carrinho abandonado por e-mail | Depende de e-mail transacional (Resend já configurável) |

## 10. Falhas visuais menores

- **Skip link visível:** ao avançar uma etapa do checkout, "Ir para o conteúdo" aparece sobre o título
  (o foco volta ao início da página). Mover o foco para o título da etapa.
  Onde: `components/CheckoutSection.jsx`, `.skip-link` em `App.css`.
- **404 na home:** um recurso retorna 404 ao carregar a página inicial (provavelmente o ícone da aba,
  `favicon.ico`). Criar `frontend/public/` com um favicon padrão (a pasta ainda não existe) ou declarar o
  ícone no `index.html`.

---

## Como validar após as mudanças

- Repetir a navegação em celular (390 px) e desktop: home → produto → carrinho → checkout com retirada e com entrega.
- Medir no GA4 (já integrado) o funil `view_item` → `add_to_cart` → `begin_checkout` → `purchase`
  antes e depois de cada rodada.
- Testes automatizados existentes: `npm test` em `frontend/` e `backend/`.
