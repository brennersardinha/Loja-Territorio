import { useNavigate } from 'react-router-dom';
import ProductCard from './ui/ProductCard';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import Skeleton from './ui/Skeleton';
import { useBranding } from '../contexts/BrandingContext';

export default function HomeSection({ products, categories, loading, error, formatPrice, addToCart, toggleWishlist }) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const featured = products.slice(0, 4);
  const openCatalog = (params = {}) => {
    const query = new URLSearchParams(params);
    navigate(`/buscar${query.size ? `?${query}` : ''}`);
  };

  return <div className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-content"><span className="eyebrow">Novidades para você</span><h1 id="home-title">{branding.texts.welcome}</h1><p>Explore novidades, ofertas e escolhas especiais em uma experiência de compra simples e segura.</p><div className="button-row"><Button size="lg" onClick={() => openCatalog()}>Ver produtos</Button><Button variant="secondary" size="lg" onClick={() => openCatalog({ ordenacao: 'menor_preco' })}>Explorar ofertas</Button></div></div>
      <div className="home-hero-art" aria-hidden="true"><span>Compra fácil</span><strong>Do catálogo até sua casa.</strong></div>
    </section>
    {categories.length > 0 && <section className="home-section" aria-labelledby="categories-title"><div className="section-heading"><div><span className="eyebrow">Explore</span><h2 id="categories-title">Compre por categoria</h2></div></div><div className="category-grid">{categories.slice(0, 6).map((category) => <button key={category.id} className="category-card" type="button" onClick={() => openCatalog({ categoria_id: category.id })}><span aria-hidden="true">→</span><strong>{category.nome}</strong><small>Ver produtos</small></button>)}</div></section>}
    <section className="home-section" aria-labelledby="featured-title"><div className="section-heading"><div><span className="eyebrow">Seleção da loja</span><h2 id="featured-title">Produtos em destaque</h2></div><Button variant="ghost" size="sm" onClick={() => openCatalog()}>Ver todos →</Button></div>{loading && !error && featured.length === 0 && <div className="home-products" aria-label="Carregando produtos">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</div>}{(!loading || error) && featured.length === 0 && <EmptyState title={error || 'Nenhum produto disponível'} description={error ? 'Não foi possível carregar as novidades. Tente novamente em instantes.' : 'Visite novamente em breve para conferir as novidades.'} actionLabel="Abrir catálogo" onAction={() => openCatalog()} />}{featured.length > 0 && <div className="home-products">{featured.map((product) => <ProductCard key={product.id} product={product} formatPrice={formatPrice} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} onDetails={(item) => navigate(`/produto/${item.id}/${item.slug || 'produto'}`)} />)}</div>}</section>
    <section className="benefits-grid" aria-label="Benefícios da loja"><article><span aria-hidden="true">◇</span><div><strong>Entrega acompanhada</strong><p>Acompanhe seu pedido em todas as etapas.</p></div></article><article><span aria-hidden="true">✓</span><div><strong>Compra segura</strong><p>Seus dados protegidos durante o pagamento.</p></div></article><article><span aria-hidden="true">↺</span><div><strong>Troca descomplicada</strong><p>Suporte claro quando você precisar.</p></div></article></section>
  </div>;
}
