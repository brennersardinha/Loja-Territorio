// URL canônica da página do produto; usa o slug salvo ou o gera a partir do nome.
export function productUrl(product) {
  const slug = product.slug || String(product.nome || 'produto')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `/produto/${product.produto_id || product.id}/${slug || 'produto'}`;
}
