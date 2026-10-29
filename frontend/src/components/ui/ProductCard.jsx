import Button from './Button';
import ResponsiveImage from './ResponsiveImage';
import { uiCopy } from '../../config/uiCopy';

export function productPhoto(product) {
  return Array.isArray(product?.fotos_produto) ? product.fotos_produto.find(Boolean) : '';
}

export default function ProductCard({ product, formatPrice, onAddToCart, onToggleWishlist, onDetails, wishlistActive = false }) {
  const photo = productPhoto(product);
  const available = Number(product.estoque) > 0;
  const lowStock = available && Number(product.estoque) <= 5;
  const rating = Number(product.avaliacao_media || product.rating || 0);
  const reviewCount = Number(product.total_avaliacoes || product.review_count || 0);
  const oldPrice = Number(product.preco_anterior || 0);
  const currentPrice = Number(product.preco || product.preco_atual || 0);

  return (
    <article className="product-card">
      <div className="product-media">
        <ResponsiveImage className="product-card-image" src={photo} alt={product.nome} fallbackLabel={uiCopy.product.imageUnavailable(product.nome)} style={{ objectFit: product.foto_exibicao_fit || 'cover', objectPosition: product.foto_exibicao_position || 'center' }} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {!product.badge && lowStock && <span className="product-badge">Últimas unidades</span>}
        {onToggleWishlist && <button className={`wishlist-button ${wishlistActive ? 'active' : ''}`} type="button" onClick={() => onToggleWishlist(product)} aria-label={`${wishlistActive ? 'Remover' : 'Adicionar'} ${product.nome} ${wishlistActive ? 'dos' : 'aos'} favoritos`} aria-pressed={wishlistActive}>{wishlistActive ? '♥' : '♡'}</button>}
      </div>
      <div className="product-card-content">
        <span className="product-category">{product.categoria_nome || uiCopy.product.uncategorized}</span>
        <h3>{product.nome}</h3>
        <p className="product-description">{product.descricao || uiCopy.product.noDescription}</p>
        <div className="product-rating" aria-label={reviewCount ? `${rating.toFixed(1)} de 5, ${reviewCount} avaliações` : 'Produto ainda sem avaliações'}>
          <span aria-hidden="true">{reviewCount ? `★ ${rating.toFixed(1)}` : '☆ ☆ ☆ ☆ ☆'}</span><small>{reviewCount ? `(${reviewCount})` : 'Sem avaliações'}</small>
        </div>
      </div>
      <div className="product-card-footer">
        <div className="product-price"><strong>{formatPrice(currentPrice)}</strong>{oldPrice > currentPrice && <del>{formatPrice(oldPrice)}</del>}</div>
        <div className="card-actions">
          {onAddToCart && <Button size="sm" onClick={() => onAddToCart(product)} disabled={!available}>{available ? uiCopy.actions.addToCart : uiCopy.product.unavailable}</Button>}
          {onDetails && <Button variant="ghost" size="sm" onClick={() => onDetails(product)}>{uiCopy.actions.viewDetails}</Button>}
        </div>
      </div>
    </article>
  );
}
