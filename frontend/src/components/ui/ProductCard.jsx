import Button from './Button';
import Icon from './Icon';
import ResponsiveImage from './ResponsiveImage';
import { uiCopy } from '../../config/uiCopy';
import { productUrl } from '../../utils/productUrl';

const NEW_PRODUCT_DAYS = 30;

export function productPhoto(product) {
  return Array.isArray(product?.fotos_produto) ? product.fotos_produto.find(Boolean) : '';
}

// Selo real do produto, em ordem de prioridade: definido pelo lojista, oferta, estoque baixo ou novidade.
export function productBadge(product) {
  const stock = Number(product.estoque);
  const price = Number(product.preco || product.preco_atual || 0);
  if (product.badge) return product.badge;
  if (Number(product.preco_anterior || 0) > price) return uiCopy.product.badges.sale;
  if (stock > 0 && stock <= 5) return uiCopy.product.badges.lowStock;
  const createdAt = Date.parse(product.created_at);
  if (createdAt && Date.now() - createdAt < NEW_PRODUCT_DAYS * 86_400_000) return uiCopy.product.badges.new;
  return null;
}

export default function ProductCard({ product, formatPrice, onAddToCart, onToggleWishlist, onDetails, wishlistActive = false, pickupAvailable = false }) {
  const photo = productPhoto(product);
  const available = Number(product.estoque) > 0;
  const badge = productBadge(product);
  const rating = Number(product.avaliacao_media || product.rating || 0);
  const reviewCount = Number(product.total_avaliacoes || product.review_count || 0);
  const oldPrice = Number(product.preco_anterior || 0);
  const currentPrice = Number(product.preco || product.preco_atual || 0);
  const openDetails = (event) => {
    if (!onDetails) return;
    event.preventDefault();
    onDetails(product);
  };

  return (
    <article className="product-card">
      <div className="product-media">
        <ResponsiveImage className="product-card-image" src={photo} alt={product.nome} fallbackLabel={uiCopy.product.imageUnavailable(product.nome)} style={{ objectFit: product.foto_exibicao_fit || 'cover', objectPosition: product.foto_exibicao_position || 'center' }} />
        {badge && <span className="product-badge">{badge}</span>}
        {onToggleWishlist && <button className={`wishlist-button ${wishlistActive ? 'active' : ''}`} type="button" onClick={() => onToggleWishlist(product)} aria-label={`${wishlistActive ? 'Remover' : 'Adicionar'} ${product.nome} ${wishlistActive ? 'dos' : 'aos'} favoritos`} aria-pressed={wishlistActive}>{wishlistActive ? '♥' : '♡'}</button>}
      </div>
      <div className="product-card-content">
        {product.categoria_nome && <span className="product-card-category">{product.categoria_nome}</span>}
        {/* O link do título cobre o cartão inteiro (::after); botões ficam acima dele. */}
        <h3><a className="product-card-link" href={productUrl(product)} onClick={openDetails}>{product.nome}</a></h3>
        {product.descricao && <p className="product-description">{product.descricao}</p>}
        {reviewCount > 0 && <div className="product-rating" aria-label={`${rating.toFixed(1)} de 5, ${reviewCount} avaliações`}><span aria-hidden="true">★ {rating.toFixed(1)}</span><small aria-hidden="true">({reviewCount})</small></div>}
        {pickupAvailable && available && <p className="pickup-hint"><Icon name="store" size={16} />{uiCopy.pickup.short}</p>}
      </div>
      <div className="product-card-footer">
        <div className="product-price"><strong>{formatPrice(currentPrice)}</strong>{oldPrice > currentPrice && <del>{formatPrice(oldPrice)}</del>}</div>
        {onAddToCart && <Button size="sm" onClick={() => onAddToCart(product)} disabled={!available}>{available ? uiCopy.actions.addToCart : uiCopy.product.unavailable}</Button>}
      </div>
    </article>
  );
}
