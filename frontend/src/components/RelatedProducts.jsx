import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductCard from './ui/ProductCard';
import Button from './ui/Button';
import { productUrl } from '../utils/productUrl';

// Vitrine de produtos de uma categoria, sem repetir os que já estão na página ou no carrinho.
// Usada como "Complete o visual" (produto e carrinho) e nas seções configuráveis da página inicial.
export default function RelatedProducts({ categoryId, excludeIds = [], title = 'Complete o visual', formatPrice, addToCart, toggleWishlist, pickupAvailable, limit = 4, showViewAll = false }) {
  const navigate = useNavigate();
  const headingId = useId();
  const [items, setItems] = useState([]);
  const excluded = excludeIds.map(Number).sort().join(',');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: '1', limit: String(limit + excludeIds.length) });
    if (categoryId) params.set('categoria_id', categoryId);
    fetch(`/api/products?${params}`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data) => { if (active) setItems((data.items || []).filter((item) => !excludeIds.map(Number).includes(Number(item.id)) && Number(item.estoque) > 0).slice(0, limit)); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [categoryId, excluded, limit]);

  if (!items.length) return null;
  return <section className="home-section related-products" aria-labelledby={headingId}>
    <div className="section-heading"><h2 id={headingId}>{title}</h2>{showViewAll && categoryId && <Button variant="ghost" size="sm" onClick={() => navigate(`/buscar?categoria_id=${categoryId}`)}>Ver todos →</Button>}</div>
    <div className="home-products">{items.map((item) => <ProductCard key={item.id} product={item} formatPrice={formatPrice} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} onDetails={(product) => navigate(productUrl(product))} pickupAvailable={pickupAvailable} />)}</div>
  </section>;
}
