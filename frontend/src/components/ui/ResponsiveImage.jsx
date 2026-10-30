import { useState } from 'react';
import { useBranding } from '../../contexts/BrandingContext';
import Icon from './Icon';

export default function ResponsiveImage({ src, alt, fallbackLabel, eager = false, className = '', ...props }) {
  const [failed, setFailed] = useState(false);
  const { branding } = useBranding();
  const label = fallbackLabel || `Imagem indisponível${alt ? ` para ${alt}` : ''}`;

  // Sem foto: ilustração neutra com o logo da loja; o texto fica só para leitores de tela.
  if (!src || failed) {
    return <span className={`responsive-image-fallback ${className}`.trim()} role="img" aria-label={label}>{branding.logo ? <img className="fallback-logo" src={branding.logo} alt="" /> : <Icon name="bag" size={40} />}</span>;
  }

  return (
    <img
      {...props}
      className={className}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
