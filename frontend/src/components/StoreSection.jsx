import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import ProductReviews from './ProductReviews';
import ProductGallery from './ProductGallery';
import RelatedProducts from './RelatedProducts';
import ShippingEstimator from './ShippingEstimator';
import { analyticsItem, trackEvent } from '../utils/analytics';
import { productUrl } from '../utils/productUrl';
import { validatePriceFilters } from '../utils/formValidation';
import useStoreInfo from '../hooks/useStoreInfo';
import ProductCard, { priceUnit } from './ui/ProductCard';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { formatAttributeValue } from '../utils/formatAttributeValue';

const FILTER_KEYS = ['busca', 'categoria_id', 'min_preco', 'max_preco'];

function filtersFromParams(searchParams) {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) || '']));
}

export default function StoreSection({
  products,
  categories,
  selectedProduct,
  productFilters,
  productPagination,
  onFiltersChange,
  setProductFilters,
  addToCart,
  toggleWishlist,
  fetchProductDetails,
  fetchProducts,
  formatPrice,
  changeProductPage,
  token,
  user,
  productId,
  loading,
  setStatus,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(searchParams.get('ordenacao') || 'relevancia');
  const [quantity, setQuantity] = useState(1);
  const lastViewedProductId = useRef(null);
  const { storeInfo } = useStoreInfo();
  const { pickup, policies } = storeInfo;
  const getPhotos = (product) => (Array.isArray(product?.fotos_produto) ? product.fotos_produto.filter(Boolean) : []);

  useEffect(() => {
    if (productId && selectedProduct?.id !== productId) {
      fetchProductDetails(productId);
    }
  }, [fetchProductDetails, productId, selectedProduct?.id]);

  useEffect(() => { setQuantity(1); }, [productId]);

  useEffect(() => {
    if (!productId || selectedProduct?.id !== productId || lastViewedProductId.current === productId) return;
    lastViewedProductId.current = productId;
    trackEvent('view_item', {
      currency: 'BRL',
      value: Number(selectedProduct.preco || 0),
      items: [analyticsItem(selectedProduct)],
    });
  }, [productId, selectedProduct]);

  // A URL é a fonte dos filtros: a busca do cabeçalho e os filtros da página só alteram a URL.
  const paramsKey = searchParams.toString();
  useEffect(() => {
    if (productId) return;
    const filters = filtersFromParams(searchParams);
    setProductFilters(filters);
    setSort(searchParams.get('ordenacao') || 'relevancia');
    fetchProducts(filters, 1);
  }, [productId, paramsKey]);

  const applyFilters = (event) => {
    event?.preventDefault();
    const validationError = validatePriceFilters(productFilters);
    if (validationError) { setStatus?.(validationError); return; }
    const params = new URLSearchParams();
    Object.entries(productFilters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
    if (sort !== 'relevancia') params.set('ordenacao', sort);
    if (params.toString() === paramsKey) fetchProducts(productFilters, 1);
    else setSearchParams(params);
    setFiltersOpen(false);
  };
  const clearFilters = () => {
    setSort('relevancia');
    setFiltersOpen(false);
    if (paramsKey) setSearchParams({});
    else fetchProducts(filtersFromParams(new URLSearchParams()), 1);
  };
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
    const stock = Number(selectedProduct.estoque);
    const available = stock > 0;
    const rating = Number(selectedProduct.avaliacao_media || 0);
    const reviewCount = Number(selectedProduct.total_avaliacoes || 0);
    const oldPrice = Number(selectedProduct.preco_anterior || 0);
    const unit = priceUnit(selectedProduct);
    const attributes = Object.entries(selectedProduct.atributos_dinamicos || {});
    const buyNow = async () => { if (await addToCart(selectedProduct, quantity)) navigate('/checkout'); };
    return <section className="product-detail-page">
      <nav className="breadcrumb" aria-label="Navegação estrutural"><button type="button" onClick={() => navigate('/buscar')}>Produtos</button>{selectedProduct.categoria_id && <><span aria-hidden="true">/</span><button type="button" onClick={() => navigate(`/buscar?categoria_id=${selectedProduct.categoria_id}`)}>{selectedProduct.categoria_nome}</button></>}<span aria-hidden="true">/</span><span aria-current="page">{selectedProduct.nome}</span></nav>
      <div className="product-detail-main">
        <ProductGallery product={selectedProduct} photos={photos} />
        <div className="product-detail-info">
          <h1>{selectedProduct.nome}</h1>
          {reviewCount > 0 && <a className="product-rating" href="#reviews-heading" aria-label={`${rating.toFixed(1)} de 5, ${reviewCount} avaliações`}><span aria-hidden="true">★ {rating.toFixed(1)}</span><small aria-hidden="true">{reviewCount} avaliações</small></a>}
          <div className="detail-price"><strong>{formatPrice(selectedProduct.preco)}</strong>{unit && <span className="price-unit">/ {unit}</span>}{oldPrice > Number(selectedProduct.preco) && <del>{formatPrice(oldPrice)}</del>}</div>
          <p className={`availability ${available ? 'available' : 'unavailable'}`}>{available ? (stock <= 5 ? `Últimas ${stock} unidades` : 'Em estoque') : 'Indisponível no momento'}</p>
          {pickup.enabled && available && <div className="pickup-badge"><Icon name="store" /><span><strong>Retire grátis na loja</strong><small>{pickup.address}{pickup.hours ? ` · ${pickup.hours}` : ''}</small></span></div>}
          <label className="quantity-field">Quantidade<div className="quantity-stepper"><Button variant="ghost" size="sm" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || !available} aria-label="Diminuir quantidade">−</Button><output aria-live="polite">{quantity}</output><Button variant="ghost" size="sm" onClick={() => setQuantity((value) => Math.min(stock, value + 1))} disabled={quantity >= stock || !available} aria-label="Aumentar quantidade">+</Button></div></label>
          <div className="product-detail-actions"><Button fullWidth size="lg" onClick={() => addToCart(selectedProduct, quantity)} disabled={!available}>{available ? 'Adicionar ao carrinho' : 'Produto indisponível'}</Button><Button fullWidth variant="dark" size="lg" onClick={buyNow} disabled={!available}>Comprar agora</Button><Button fullWidth variant="ghost" onClick={() => toggleWishlist(selectedProduct)}>♡ Adicionar aos favoritos</Button></div>
          {available && <ShippingEstimator productId={selectedProduct.id} quantity={quantity} formatPrice={formatPrice} />}
          <p className="product-detail-description">{selectedProduct.descricao || 'Produto sem descrição cadastrada.'}</p>
          {attributes.length > 0 && <fieldset className="product-options"><legend>Características</legend>{attributes.map(([key, value]) => <div key={key}><span>{key}</span><strong>{formatAttributeValue(value)}</strong></div>)}</fieldset>}
          {policies.exchanges && <p className="delivery-note"><NavLink to="/politicas/trocas">Política de trocas e devoluções</NavLink></p>}
          {selectedProduct.sku && <small className="product-code">Código do produto: {selectedProduct.sku}</small>}
        </div>
      </div>
      <ProductReviews className="panel product-reviews-section" productId={selectedProduct.id} token={token} user={user} />
      <RelatedProducts categoryId={selectedProduct.categoria_id} excludeIds={[selectedProduct.id]} formatPrice={formatPrice} addToCart={addToCart} toggleWishlist={toggleWishlist} pickupAvailable={pickup.enabled} />
      {/* No celular, preço e compra ficam sempre ao alcance do polegar. */}
      <div className="mobile-buy-bar" aria-label="Compra rápida"><div><strong>{formatPrice(Number(selectedProduct.preco) * quantity)}</strong><small>{!available ? 'Indisponível' : unit ? (quantity > 1 ? `${quantity} × ${unit}` : `por ${unit}`) : quantity > 1 ? `${quantity} unidades` : ''}</small></div><Button onClick={() => addToCart(selectedProduct, quantity)} disabled={!available}>{available ? 'Adicionar ao carrinho' : 'Indisponível'}</Button></div>
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
          {sortedProducts.map((product) => <ProductCard key={product.id} product={product} formatPrice={formatPrice} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} onDetails={(item) => navigate(productUrl(item))} pickupAvailable={pickup.enabled} />)}
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
