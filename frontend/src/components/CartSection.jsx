import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Icon from './ui/Icon';
import CartItemCard from './ui/CartItemCard';
import RelatedProducts from './RelatedProducts';
import { useBranding } from '../contexts/BrandingContext';
import useStoreInfo from '../hooks/useStoreInfo';
import { uiCopy } from '../config/uiCopy';

// Cupom validado no carrinho; o código segue para o checkout, onde o desconto é recalculado.
function CouponField({ subtotal, couponCode, onCouponChange, formatPrice }) {
  const [code, setCode] = useState(couponCode || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function apply(event) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: normalized, subtotal }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cupom inválido.');
      setResult(data); onCouponChange(normalized);
    } catch (requestError) {
      setResult(null); setError(requestError.message); onCouponChange('');
    } finally { setLoading(false); }
  }
  const remove = () => { setCode(''); setResult(null); setError(''); onCouponChange(''); };

  if (result) return <div className="summary-line coupon-applied"><span>Cupom {result.coupon.code}</span><span>− {formatPrice(result.discount_amount)} <button type="button" className="link-button" onClick={remove}>remover</button></span></div>;
  return <form className="coupon-field" onSubmit={apply}>
    <label htmlFor="cart-coupon">Cupom de desconto</label>
    <div className="inline-field"><input id="cart-coupon" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Digite o código" autoCapitalize="characters" /><Button type="submit" variant="ghost" loading={loading}>Aplicar</Button></div>
    {error && <p className="error-message" role="alert">{error}</p>}
  </form>;
}

export default function CartSection({ cartItems, cartSubtotal, formatPrice, updateCartItem, removeCartItem, addToCart, toggleWishlist, couponCode = '', onCouponChange = () => {} }) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { storeInfo } = useStoreInfo();
  const { pickup, shipping = {} } = storeInfo;
  const subtotal = cartSubtotal();
  const unavailable = cartItems.some((item) => Number(item.estoque) <= 0);
  const totalUnits = cartItems.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  const priceChanged = cartItems.some((item) => item.preco_unitario != null && item.preco_atual != null && Number(item.preco_unitario) !== Number(item.preco_atual));
  const freeShippingMin = Number(shipping.free_shipping_min || 0);
  const missingForFreeShipping = Math.max(0, freeShippingMin - subtotal);
  const relatedCategory = cartItems.find((item) => item.categoria_id)?.categoria_id;
  return (
    <>
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
        {freeShippingMin > 0 && <div className="free-shipping-progress">{missingForFreeShipping > 0 ? <p>Faltam <strong>{formatPrice(missingForFreeShipping)}</strong> para ganhar frete grátis.</p> : <p><strong>Você ganhou frete grátis!</strong></p>}<progress max={freeShippingMin} value={Math.min(subtotal, freeShippingMin)} aria-label="Progresso para frete grátis" /></div>}
        <div className="summary-line"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
        <div className="summary-line"><span>Frete</span><span>{freeShippingMin > 0 && missingForFreeShipping === 0 ? 'Grátis' : 'Calculado no checkout'}</span></div>
        {pickup.enabled && <p className="pickup-hint"><Icon name="store" size={16} />{uiCopy.pickup.short} · {pickup.address}</p>}
        <CouponField subtotal={subtotal} couponCode={couponCode} onCouponChange={onCouponChange} formatPrice={formatPrice} />
        <div className="summary-line summary-total"><span>Total parcial</span><strong>{formatPrice(subtotal)}</strong></div>
        {unavailable && <p className="item-alert" role="alert">Remova produtos indisponíveis antes de continuar.</p>}
        <Button fullWidth size="lg" onClick={() => navigate('/checkout')} disabled={unavailable}>Finalizar compra</Button>
        <Button fullWidth variant="ghost" onClick={() => navigate('/buscar')}>Continuar comprando</Button>
      </aside>}
    </section>
    {cartItems.length > 0 && addToCart && <RelatedProducts categoryId={relatedCategory} excludeIds={cartItems.map((item) => item.produto_id)} formatPrice={formatPrice} addToCart={addToCart} toggleWishlist={toggleWishlist} pickupAvailable={pickup.enabled} />}
    </>
  );
}
