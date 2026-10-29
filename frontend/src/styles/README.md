# Tokens do design system

`tokens.css` é a fonte oficial dos valores visuais do frontend. `App.css` e componentes devem consumir tokens semânticos, sem repetir cores ou sombras.

## Grupos

- Cores de marca: `--primary`, `--primary-hover`, `--primary-active`, `--primary-foreground` e `--secondary`.
- Superfícies: `--background`, `--card`, `--surface-subtle`, `--muted` e `--accent`.
- Texto e borda: `--foreground`, `--foreground-strong`, `--muted-foreground`, `--placeholder`, `--border` e `--border-strong`.
- Feedback: `--destructive-*`, `--success-*`, `--warning-*` e `--info`.
- Interação: `--ring`, `--focus-ring`, alturas de controle e cores de estado.
- Tipografia: `--font-sans`, `--font-mono` e escala `--text-*`.
- Layout: escala `--space-*`, `--radius-*`, `--shadow-*` e `--container-max`.

A hierarquia oficial usa H1/display a partir de 32 px, H2 de 24 px, H3 de 20 px, título de card e corpo de 16 px e legenda de 12 px. Os pesos permitidos são 400, 500, 600 e 700. Inter é a fonte de interface; DM Mono identifica SKU, preço e códigos de pedido por meio de `.technical-data`.

Os espaços aceitos são 4, 8, 12, 16, 24, 32, 40, 48, 64 e 80 px. Controles usam `--radius-control`, mídia usa `--radius-media`, cards usam `--radius-card` e elementos circulares/pílulas usam `--radius-pill`.

Os tokens `--color-*` são aliases temporários para telas legadas. Código novo deve preferir os nomes semânticos sem o prefixo `color`. A remoção dos aliases só pode ocorrer depois que nenhuma tela os consumir.

## White-Label

`BrandingContext` altera os tokens de marca, fundo, texto, fonte e raio. Estados derivados da cor primária — hover, active, accent, borda e foco — também são recalculados, evitando que o tema use estados azuis fixos depois da personalização.

Valores enviados pelo tenant devem continuar sujeitos à validação de contraste e formato no painel de Branding. Tokens de sucesso, alerta e erro não devem ser substituídos pela cor de marca.

## Regra de manutenção

Antes de adicionar um valor visual a um componente:

1. Reutilize um token semântico existente.
2. Se o papel visual ainda não existir e for recorrente, crie um token com nome baseado na função, não na cor.
3. Mantenha valores específicos de layout locais apenas quando não forem reutilizáveis.
4. Não use fallback de cor em `var()`: a ausência de token deve ser detectável durante desenvolvimento.
