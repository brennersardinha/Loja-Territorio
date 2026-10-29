import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProductReviews from './ProductReviews';
import { analyticsItem, trackEvent } from '../utils/analytics';
import ProductCard from './ui/ProductCard';
import Button from './ui/Button';
import { formatAttributeValue } from '../utils/formatAttributeValue';

export default function StoreSection({
  products,
  categories,
  selectedProduct,
  productFilters,
  productPagination,
  onFiltersChange,
  setProductFilters,
  submitProductFilters,
  clearProductFilters,
  addToCart,
  toggleWishlist,
  fetchProductDetails,
  fetchProducts,
  formatPrice,
  renderAttributes,
  changeProductPage,
  token,
  user,
  productId,
  loading,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(searchParams.get('ordenacao') || 'relevancia');
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const lastViewedProductId = useRef(null);
  const getPhotos = (product) => (Array.isArray(product?.fotos_produto) ? product.fotos_produto.filter(Boolean) : []);

  const getImageStyle = (product) => ({
    objectFit: product?.foto_exibicao_fit || 'cover',
    objectPosition: product?.foto_exibicao_position || 'center',
  });

  useEffect(() => {
    if (productId && selectedProduct?.id !== productId) {
      fetchProductDetails(productId);
    }
  }, [fetchProductDetails, productId, selectedProduct?.id]);

  useEffect(() => {
    if (!productId || selectedProduct?.id !== productId || lastViewedProductId.current === productId) return;
    lastViewedProductId.current = productId;
    trackEvent('view_item', {
      currency: 'BRL',
      value: Number(selectedProduct.preco || 0),
      items: [analyticsItem(selectedProduct)],
    });
  }, [productId, selectedProduct]);

  const productUrl = (product) => `/produto/${product.id}/${product.slug || String(product.nome || 'produto')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto'}`;

  useEffect(() => {
    if (productId) return;
    const filters = { busca: searchParams.get('busca') || '', categoria_id: searchParams.get('categoria_id') || '', min_preco: searchParams.get('min_preco') || '', max_preco: searchParams.get('max_preco') || '' };
    setProductFilters(filters);
    setSort(searchParams.get('ordenacao') || 'relevancia');
    fetchProducts(filters, 1);
  }, []);

  const applyFilters = (event) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    Object.entries(productFilters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
    if (sort !== 'relevancia') params.set('ordenacao', sort);
    setSearchParams(params);
    submitProductFilters(event);
    setFiltersOpen(false);
  };
  const clearFilters = () => { setSort('relevancia'); setSearchParams({}); clearProductFilters(); setFiltersOpen(false); };
  const sortedProducts = useMemo(() => [...products].sort((a, b) => {
    if (sort === 'menor_preco') return Number(a.preco) - Number(b.preco);
    if (sort === 'maior_preco') return Number(b.preco) - Number(a.preco);
    if (sort === 'melhor_avaliacao') return Number(b.avaliacao_media || 0) - Number(a.avaliacao_media || 0);
    return 0;
  }), [products, sort]);
  const activeFilters = [productFilters.busca && `Busca: ${productFilters.busca}`, productFilters.categoria_id && `Categoria: ${categories.find((item) => String(item.id) === String(productFilters.categoria_id))?.nome || productFilters.categoria_id}`, productFilters.min_preco && `A partir de ${formatPrice(productFilters.min_preco)}`, productFilters.max_preco && `Até ${formatPrice(productFilters.max_preco)}`].filter(Boolean);

  if (productId) {
    if (!selectedProduct || selectedProduct.id !== productId) return <section className="panel product-loading" aria-live="polite"><h2>Carregando produto...</h2><p className="muted-text">Estamos preparando os detalhes para você.</p></section>;
    const photos = getPhotos(selectedProduct);
    const available = Number(selectedProduct.estoque) > 0;
    const rating = Number(selectedProduct.avaliacao_media || 0);
    const reviewCount = Number(selectedProduct.total_avaliacoes || 0);
    const oldPrice = Number(selectedProduct.preco_anterior || 0);
    const attributes = Object.entries(selectedProduct.atributos_dinamicos || {});
    const buyNow = async () => { if (await addToCart(selectedProduct, quantity)) navigate('/checkout'); };
    return <section className="product-detail-page">
      <nav className="breadcrumb" aria-label="Navegação estrutural"><button type="button" onClick={() => navigate('/buscar')}>Produtos</button><span aria-hidden="true">/</span><span aria-current="page">{selectedProduct.nome}</span></nav>
      <div className="product-detail-main">
        <div className="product-detail-gallery">
          <div className="product-main-media">{photos.length ? <img src={photos[selectedPhoto] || photos[0]} alt={selectedProduct.nome} style={getImageStyle(selectedProduct)} decoding="async" /> : <div className="product-image-fallback" role="img" aria-label={`Imagem indisponível para ${selectedProduct.nome}`}>Imagem indisponível</div>}</div>
          {photos.length > 1 && <div className="product-thumbnails" aria-label="Imagens do produto">{photos.map((photo, index) => <button key={`${photo}-${index}`} type="button" className={selectedPhoto === index ? 'active' : ''} onClick={() => setSelectedPhoto(index)} aria-label={`Ver imagem ${index + 1} de ${selectedProduct.nome}`} aria-pressed={selectedPhoto === index}><img src={photo} alt="" loading="lazy" decoding="async" style={getImageStyle(selectedProduct)} /></button>)}</div>}
        </div>
        <div className="product-detail-info">
          <div className="product-meta">{selectedProduct.sku && <span className="technical-data">{selectedProduct.sku}</span>}<span className={`availability ${available ? 'available' : 'unavailable'}`}>{available ? '✓ Em estoque' : '× Indisponível'}</span></div>
          <span className="product-category">{selectedProduct.categoria_nome || 'Sem categoria'}</span><h1>{selectedProduct.nome}</h1>
          <div className="product-rating" aria-label={reviewCount ? `${rating.toFixed(1)} de 5, ${reviewCount} avaliações` : 'Produto ainda sem avaliações'}><span aria-hidden="true">★ {rating ? rating.toFixed(1) : '—'}</span><small>{reviewCount ? `${reviewCount} avaliações` : 'Sem avaliações'}</small></div>
          <div className="detail-price"><strong>{formatPrice(selectedProduct.preco)}</strong>{oldPrice > Number(selectedProduct.preco) && <del>{formatPrice(oldPrice)}</del>}</div>
          <p className="product-detail-description">{selectedProduct.descricao || 'Produto sem descrição cadastrada.'}</p>
          {attributes.length > 0 && <fieldset className="product-options"><legend>Características</legend>{attributes.map(([key, value]) => <div key={key}><span>{key}</span><strong>{formatAttributeValue(value)}</strong></div>)}</fieldset>}
          <label className="quantity-field">Quantidade<div className="quantity-stepper"><Button variant="ghost" size="sm" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || !available} aria-label="Diminuir quantidade">−</Button><output aria-live="polite">{quantity}</output><Button variant="ghost" size="sm" onClick={() => setQuantity((value) => Math.min(Number(selectedProduct.estoque), value + 1))} disabled={quantity >= Number(selectedProduct.estoque) || !available} aria-label="Aumentar quantidade">+</Button></div></label>
          <p className="stock-message" role="status">{available ? `${selectedProduct.estoque} unidade(s) disponível(is)` : 'Este produto não pode ser comprado no momento.'}</p>
          <div className="product-detail-actions"><Button fullWidth size="lg" onClick={() => addToCart(selectedProduct, quantity)} disabled={!available}>{available ? 'Adicionar ao carrinho' : 'Produto indisponível'}</Button><Button fullWidth variant="dark" size="lg" onClick={buyNow} disabled={!available}>Comprar agora</Button><Button fullWidth variant="ghost" onClick={() => toggleWishlist(selectedProduct)}>♡ Adicionar aos favoritos</Button></div>
          <div className="delivery-note"><strong>Entrega e devolução</strong><p>O prazo e o valor do frete são calculados no checkout. Consulte também nossa política de trocas.</p></div>
        </div>
      </div>
      <div className="panel product-reviews-section"><ProductReviews productId={selectedProduct.id} token={token} user={user} /></div>
    </section>;
  }

  return (
    <section className="panel wide-panel store-panel">
      <div className="panel-header catalog-heading">
        <div><span className="eyebrow">Encontre seu próximo favorito</span><h2>Produtos da loja</h2></div>
        <span className="result-count" aria-live="polite">{productPagination.total || products.length} produtos</span>
      </div>

      <div className="catalog-toolbar"><button className="ghost-button mobile-filter-trigger" type="button" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(true)}>☷ Filtros {activeFilters.length ? `(${activeFilters.length})` : ''}</button><label className="sort-field">Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevancia">Relevância</option><option value="menor_preco">Menor preço</option><option value="maior_preco">Maior preço</option><option value="melhor_avaliacao">Melhor avaliação</option></select></label></div>
      {activeFilters.length > 0 && <div className="filter-chips" aria-label="Filtros ativos">{activeFilters.map((filter) => <span key={filter}>{filter}</span>)}<button type="button" onClick={clearFilters}>Limpar filtros</button></div>}
      {filtersOpen && <button className="filter-backdrop" type="button" aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} />}
      <form id="catalog-filters" className={`filters-grid catalog-filters ${filtersOpen ? 'open' : ''}`} onSubmit={applyFilters}>
        <div className="mobile-filter-heading"><strong>Filtrar produtos</strong><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros">×</button></div>
        <label className="search-field">
          Buscar produtos
          <input name="busca" type="search" value={productFilters.busca} onChange={onFiltersChange} placeholder="O que você procura?" />
        </label>
        <label>
          Categoria
          <select name="categoria_id" value={productFilters.categoria_id} onChange={onFiltersChange}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preço mínimo
          <input name="min_preco" type="number" min="0" step="0.01" value={productFilters.min_preco} onChange={onFiltersChange} />
        </label>
        <label>
          Preço máximo
          <input name="max_preco" type="number" min="0" step="0.01" value={productFilters.max_preco} onChange={onFiltersChange} />
        </label>
        <div className="button-row filter-actions">
          <button className="primary-button" type="submit">Buscar</button>
          <button className="ghost-button" type="button" onClick={clearFilters}>Limpar</button>
        </div>
      </form>

      <div className="store-layout">
        <div className="product-grid">
          {sortedProducts.map((product) => <ProductCard key={product.id} product={product} formatPrice={formatPrice} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} onDetails={(item) => navigate(productUrl(item))} />)}
          {!loading && products.length === 0 && <div className="empty-state"><strong>Nenhum produto encontrado</strong><span>Tente remover os filtros ou buscar por outro termo.</span><button className="ghost-button compact" type="button" onClick={clearFilters}>Limpar filtros</button></div>}
        </div>

      </div>

      <div className="pagination">
        <button className="ghost-button compact" type="button" onClick={() => changeProductPage(productPagination.page - 1)} disabled={productPagination.page <= 1}>
          ← Anterior
        </button>
        <span>Página {productPagination.page} de {productPagination.total_pages || 1}</span>
        <button className="ghost-button compact" type="button" onClick={() => changeProductPage(productPagination.page + 1)} disabled={productPagination.page >= productPagination.total_pages}>
          Próxima →
        </button>
      </div>
    </section>
  );
}
