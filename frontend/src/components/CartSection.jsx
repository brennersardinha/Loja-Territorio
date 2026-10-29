import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import CartItemCard from './ui/CartItemCard';
import { useBranding } from '../contexts/BrandingContext';

export default function CartSection({ cartItems, cartSubtotal, formatPrice, updateCartItem, removeCartItem }) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const subtotal = cartSubtotal();
  const unavailable = cartItems.some((item) => Number(item.estoque) <= 0);
  const totalUnits = cartItems.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  const priceChanged = cartItems.some((item) => item.preco_unitario != null && item.preco_atual != null && Number(item.preco_unitario) !== Number(item.preco_atual));
  return (
    <section className="cart-page">
      <div className="panel wide-panel cart-items-panel">
        <div className="panel-header"><div><span className="eyebrow">Sua seleção</span><h1>Carrinho de compras</h1></div><span className="result-count">{totalUnits} {totalUnits === 1 ? 'item' : 'itens'}</span></div>
        {(unavailable || priceChanged) && <div className="cart-notices" aria-live="polite">{unavailable && <p className="item-alert">Há produto indisponível no carrinho.</p>}{priceChanged && <p className="item-alert">Um preço mudou desde que o produto foi adicionado.</p>}</div>}
        <div className="cart-list">
          {cartItems.map((item) => <CartItemCard key={item.id} item={item} formatPrice={formatPrice} onQuantityChange={updateCartItem} onRemove={removeCartItem} />)}
          {cartItems.length === 0 && <div className="empty-state"><strong>{branding.texts.cart_empty}</strong><span>Adicione produtos para revisar seu pedido aqui.</span><Button onClick={() => navigate('/buscar')}>Explorar produtos</Button></div>}
        </div>
      </div>
      {cartItems.length > 0 && <aside className="panel order-summary" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">Resumo do pedido</h2>
        <div className="summary-line"><span>Subtotal</span><strong className="technical-data">{formatPrice(subtotal)}</strong></div>
        <div className="summary-line"><span>Frete</span><span>Calculado no checkout</span></div>
        <div className="cart-checkout-info"><strong>Cupom e entrega</strong><p>Informe o cupom, endereço e forma de entrega na próxima etapa. Seus itens permanecerão salvos.</p></div>
        <div className="summary-line summary-total"><span>Total parcial</span><strong className="technical-data">{formatPrice(subtotal)}</strong></div>
        {unavailable && <p className="item-alert" role="alert">Remova produtos indisponíveis antes de continuar.</p>}
        <Button fullWidth size="lg" onClick={() => navigate('/checkout')} disabled={unavailable}>Ir para checkout</Button>
        <Button fullWidth variant="ghost" onClick={() => navigate('/buscar')}>Continuar comprando</Button>
      </aside>}
    </section>
  );
}
