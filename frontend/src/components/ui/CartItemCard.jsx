import Button from './Button';
import { productPhoto } from './ProductCard';
import ResponsiveImage from './ResponsiveImage';
import { uiCopy } from '../../config/uiCopy';

export default function CartItemCard({ item, formatPrice, onQuantityChange, onRemove }) {
  const photo = productPhoto(item);
  const quantity = Number(item.quantidade || 1);
  const stock = Number(item.estoque || 0);
  const unitPrice = Number(item.preco_unitario || item.preco_atual || item.preco || 0);
  const unavailable = stock <= 0;
  const priceChanged = item.preco_unitario != null && item.preco_atual != null && Number(item.preco_unitario) !== Number(item.preco_atual);
  const change = (next) => { if (next >= 1 && next <= stock) onQuantityChange(item, next); };

  return (
    <article className={`cart-item-card ${unavailable ? 'cart-item-unavailable' : ''}`}>
      <div className="cart-item-media"><ResponsiveImage src={photo} alt={item.nome} fallbackLabel={uiCopy.product.imageUnavailable(item.nome)} /></div>
      <div className="cart-item-info">
        <span className="product-category">{item.categoria_nome || 'Sem categoria'}</span>
        <h3>{item.nome}</h3>
        {item.variante && <p>{item.variante}</p>}
        <p>{formatPrice(unitPrice)} por unidade</p>
        {unavailable && <p className="item-alert" role="alert">Produto indisponível. Remova-o para continuar.</p>}
        {priceChanged && <p className="item-alert" role="status">O preço atual é {formatPrice(item.preco_atual)}.</p>}
      </div>
      <div className="quantity-stepper" aria-label={`Quantidade de ${item.nome}`}>
        <Button variant="ghost" size="sm" onClick={() => change(quantity - 1)} disabled={quantity <= 1 || unavailable} aria-label={`Diminuir quantidade de ${item.nome}`}>−</Button>
        <output aria-live="polite" aria-label="Quantidade">{quantity}</output>
        <Button variant="ghost" size="sm" onClick={() => change(quantity + 1)} disabled={quantity >= stock || unavailable} aria-label={`Aumentar quantidade de ${item.nome}`}>+</Button>
      </div>
      <strong className="technical-data cart-item-total">{formatPrice(unitPrice * quantity)}</strong>
      <Button variant="danger" size="sm" onClick={() => onRemove(item)} aria-label={`Remover ${item.nome} do carrinho`}>Remover</Button>
    </article>
  );
}
