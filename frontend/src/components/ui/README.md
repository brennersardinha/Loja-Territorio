# Componentes de interface

## Button

`Button` centraliza as variantes `primary`, `secondary`, `ghost`, `danger` e `dark`; tamanhos `sm`, `md`, `lg`; largura total, ícone e loading. Durante loading, o componente preserva o rótulo acessível, expõe `aria-busy` e permanece desabilitado para impedir submissão duplicada.

```jsx
<Button type="submit" loading={saving} loadingLabel="Salvando…">Salvar endereço</Button>
<Button variant="ghost" size="sm" startIcon="←">Voltar</Button>
```

## Field

`Field` renderiza `input`, `select` ou `textarea`, sempre com label superior e IDs estáveis. Aceita `hint`, `error`, `success`, disabled, readonly e todos os atributos nativos. Campos de senha recebem controle acessível para mostrar/ocultar sem perder o valor.

```jsx
<Field label="E-mail" type="email" hint="Usaremos para enviar o pedido." />
<Field label="CEP" error="Informe um CEP válido." aria-required="true" />
<Field label="Mensagem" as="textarea" rows={4} />
```

Mensagens de erro usam `role="alert"`; mensagens de sucesso usam `role="status"`. Ajuda e mensagens são ligadas ao controle por `aria-describedby`.

## Feedback

- `Badge`: status neutral, info, success, warning e danger, sempre com texto e ícone.
- `Alert`: mensagens persistentes com título e live region adequada.
- `EmptyState`: vazio com título, orientação e ação opcional.
- `Skeleton`: loading anunciado, com animação desativada pela preferência de movimento reduzido.
- `Toast`: título e ícone por tipo, duração de cinco segundos, pausa por mouse/foco e ação opcional.

## Grid

`.responsive-grid` usa 12 colunas no desktop, 8 no tablet e 4 no mobile. Os gutters são 24 px no desktop/tablet e 16 px no mobile. Use `.col-span-1`, `2`, `3`, `4`, `6`, `8` ou `12`; no mobile os spans são normalizados para a largura completa.

## Imagens responsivas

Use `ResponsiveImage` para mídia externa. O componente aplica carregamento adiado, decodificação assíncrona e fallback acessível em caso de URL ausente ou falha de rede. Marque `eager` somente para a imagem principal acima da dobra.
