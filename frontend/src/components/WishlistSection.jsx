import { useNavigate } from 'react-router-dom';
import ProductCard from './ui/ProductCard';
import Button from './ui/Button';

export default function WishlistSection({ user, wishlistItems, addToCart, toggleWishlist, formatPrice }) {
  const navigate = useNavigate();
  const productUrl = (product) => `/produto/${product.produto_id || product.id}/${product.slug || 'produto'}`;
  return (
    <section className="panel wide-panel">
      <div className="panel-header"><h2>Lista de desejos</h2></div>
      {!user && <div className="empty-state"><strong>Entre para salvar seus favoritos</strong><span>Sua lista ficará disponível em todos os seus dispositivos.</span><Button onClick={() => navigate('/conta')}>Entrar na conta</Button></div>}
      {user && <div className="product-grid">
        {wishlistItems.map((item) => <ProductCard key={item.produto_id || item.id} product={item} formatPrice={formatPrice} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} onDetails={(product) => navigate(productUrl(product))} wishlistActive />)}
        {wishlistItems.length === 0 && <div className="empty-state"><strong>Sua lista está vazia</strong><span>Explore o catálogo e salve os produtos que mais gostar.</span><Button onClick={() => navigate('/')}>Explorar produtos</Button></div>}
      </div>}
    </section>
  );
}
