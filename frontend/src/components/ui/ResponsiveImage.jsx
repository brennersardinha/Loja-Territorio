import { useState } from 'react';

export default function ResponsiveImage({ src, alt, fallbackLabel, eager = false, className = '', ...props }) {
  const [failed, setFailed] = useState(false);
  const label = fallbackLabel || `Imagem indisponível${alt ? ` para ${alt}` : ''}`;

  if (!src || failed) {
    return <span className={`responsive-image-fallback ${className}`.trim()} role="img" aria-label={label}>{label}</span>;
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
