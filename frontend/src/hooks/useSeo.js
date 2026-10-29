import { useEffect } from 'react';
import { useBranding } from '../contexts/BrandingContext';

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function useSeo({ pathname, product, seo } = {}) {
  const { branding } = useBranding();
  const storeName = branding?.store_name || 'Minha Loja';
  useEffect(() => {
    const isProduct = pathname?.startsWith('/produto/') && product;
    const title = seo?.meta_title || (isProduct ? (product.meta_title || `${product.nome} | ${storeName}`) : pathname === '/checkout' ? `Checkout | ${storeName}` : pathname === '/conta' ? `Minha conta | ${storeName}` : `${storeName} | Produtos e ofertas`);
    const description = seo?.meta_description || (isProduct
      ? (product.meta_description || product.descricao || `Compre ${product.nome} com segurança.`).slice(0, 160)
      : 'Encontre produtos, ofertas e uma experiência de compra segura.');
    const siteUrl = window.location.origin;
    const canonicalUrl = `${siteUrl.replace(/\/$/, '')}${pathname || '/'}`;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', seo?.type || (isProduct ? 'product' : 'website'));

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
  }, [pathname, product, seo, storeName]);
}
