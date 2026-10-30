import { useNavigate } from 'react-router-dom';
import ProductCard from './ui/ProductCard';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import Skeleton from './ui/Skeleton';
import Icon from './ui/Icon';
import ResponsiveImage from './ui/ResponsiveImage';
import RelatedProducts from './RelatedProducts';
import { useBranding } from '../contexts/BrandingContext';
import useStoreInfo from '../hooks/useStoreInfo';
import { whatsappLink } from '../layouts/ClientLayout';
import { productUrl } from '../utils/productUrl';
import { uiCopy } from '../config/uiCopy';

export default function HomeSection({ products, categories, loading, error, formatPrice, addToCart, toggleWishlist }) {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { storeInfo } = useStoreInfo();
  const { pickup, contact } = storeInfo;
  const [heroImage, ...extraBanners] = branding.banners || [];
  const sections = (branding.home_sections || []).filter((section) => categories.some((category) => Number(category.id) === Number(section.category_id)));
  const featured = products.slice(0, 4);
  const whatsapp = whatsappLink(contact.whatsapp);
  const openCatalog = (params = {}) => {
    const query = new URLSearchParams(params);
    navigate(`/buscar${query.size ? `?${query}` : ''}`);
  };
  const shelfProps = { formatPrice, addToCart, toggleWishlist, pickupAvailable: pickup.enabled };

  return <div className="home-page">
    <section className={`home-hero ${heroImage ? 'with-image' : ''}`} aria-labelledby="home-title">
      {heroImage && <picture className="home-hero-media">{branding.banner_mobile && <source media="(max-width: 800px)" srcSet={branding.banner_mobile} />}<img className="home-hero-image" src={heroImage} alt="" fetchpriority="high" decoding="async" /></picture>}
      <div className="home-hero-content"><h1 id="home-title">{branding.texts.welcome}</h1>{branding.texts.hero_subtitle && <p>{branding.texts.hero_subtitle}</p>}<div className="button-row"><Button size="lg" onClick={() => openCatalog()}>{branding.texts.hero_cta || uiCopy.whiteLabel.heroCta}</Button></div></div>
    </section>
    {(pickup.enabled || whatsapp) && <ul className="home-perks" aria-label="Vantagens da loja">
      {pickup.enabled && <li><Icon name="store" /><span><strong>{uiCopy.pickup.short}</strong><small>{pickup.address}</small></span></li>}
      {whatsapp && <li><a className="home-perk-link" href={whatsapp} target="_blank" rel="noreferrer"><Icon name="chat" /><span><strong>Atendimento pelo WhatsApp</strong><small className="home-perk-action">Fale com a gente <span aria-hidden="true">→</span></small></span></a></li>}
    </ul>}
    {categories.length > 0 && <section className="home-section" aria-labelledby="categories-title"><div className="section-heading"><h2 id="categories-title">Compre por categoria</h2></div><div className="category-grid">{categories.filter((category) => !category.parent_id).slice(0, 6).map((category) => <button key={category.id} className={`category-card ${category.imagem ? 'with-image' : ''}`} type="button" onClick={() => openCatalog({ categoria_id: category.id })}>{category.imagem && <ResponsiveImage className="category-card-image" src={category.imagem} alt="" />}<strong>{category.nome}</strong><small>Ver produtos →</small></button>)}</div></section>}
    {sections.map((section) => <RelatedProducts key={`${section.category_id}-${section.title}`} title={section.title} categoryId={section.category_id} showViewAll {...shelfProps} />)}
    {sections.length === 0 && <section className="home-section" aria-labelledby="featured-title"><div className="section-heading"><h2 id="featured-title">Novidades</h2><Button variant="ghost" size="sm" onClick={() => openCatalog()}>Ver todos →</Button></div>{loading && !error && featured.length === 0 && <div className="home-products" aria-label="Carregando produtos">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</div>}{(!loading || error) && featured.length === 0 && <EmptyState title={error || 'Nenhum produto disponível'} description={error ? 'Não foi possível carregar as novidades. Tente novamente em instantes.' : 'Visite novamente em breve para conferir as novidades.'} actionLabel="Abrir catálogo" onAction={() => openCatalog()} />}{featured.length > 0 && <div className="home-products">{featured.map((product) => <ProductCard key={product.id} product={product} formatPrice={formatPrice} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} onDetails={(item) => navigate(productUrl(item))} pickupAvailable={pickup.enabled} />)}</div>}</section>}
    {extraBanners.length > 0 && <div className="store-banners" aria-label="Destaques da loja">{extraBanners.map((banner, index) => <ResponsiveImage key={banner.slice(-32) + index} src={banner} alt={`Destaque ${index + 2} da loja`} />)}</div>}
  </div>;
}
