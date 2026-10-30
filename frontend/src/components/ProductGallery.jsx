import { useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon';
import ResponsiveImage from './ui/ResponsiveImage';

// Galeria com miniaturas e ampliação em tela cheia (Esc fecha e devolve o foco).
export default function ProductGallery({ product, photos }) {
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const imageStyle = { objectFit: product.foto_exibicao_fit || 'cover', objectPosition: product.foto_exibicao_position || 'center' };
  const current = photos[selected] || photos[0];

  useEffect(() => { setSelected(0); }, [product.id]);
  useEffect(() => {
    if (!zoomed) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') setZoomed(false);
      if (event.key === 'ArrowRight') setSelected((index) => (index + 1) % photos.length);
      if (event.key === 'ArrowLeft') setSelected((index) => (index - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); triggerRef.current?.focus(); };
  }, [zoomed, photos.length]);

  return <div className="product-detail-gallery">
    <div className="product-main-media">
      {current ? <button ref={triggerRef} type="button" className="zoom-trigger" onClick={() => setZoomed(true)} aria-label={`Ampliar imagem de ${product.nome}`}><img src={current} alt={product.nome} style={imageStyle} decoding="async" /><span className="zoom-hint" aria-hidden="true"><Icon name="zoom" size={18} /></span></button> : <ResponsiveImage src="" alt={product.nome} />}
    </div>
    {photos.length > 1 && <div className="product-thumbnails" aria-label="Imagens do produto">{photos.map((photo, index) => <button key={`${photo.slice(-24)}-${index}`} type="button" className={selected === index ? 'active' : ''} onClick={() => setSelected(index)} aria-label={`Ver imagem ${index + 1} de ${product.nome}`} aria-pressed={selected === index}><img src={photo} alt="" loading="lazy" decoding="async" style={imageStyle} /></button>)}</div>}
    {zoomed && <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Imagem ampliada de ${product.nome}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setZoomed(false); }}>
      <button ref={closeRef} type="button" className="lightbox-close" onClick={() => setZoomed(false)}>Fechar</button>
      <img src={current} alt={product.nome} />
      {photos.length > 1 && <p className="lightbox-counter">{selected + 1} de {photos.length} · use as setas para navegar</p>}
    </div>}
  </div>;
}
