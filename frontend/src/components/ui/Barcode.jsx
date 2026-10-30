import { code128Widths } from '../../utils/code128';

const QUIET_ZONE = 10;

// Código de barras Code 128 em SVG (nítido na impressora térmica), com o texto legível abaixo.
export default function Barcode({ value, height = 48, showText = true, className = '' }) {
  const widths = code128Widths(value);
  const total = widths.reduce((sum, width) => sum + width, 0) + QUIET_ZONE * 2;
  let x = QUIET_ZONE;
  const bars = widths.map((width, index) => {
    const bar = index % 2 === 0 ? <rect key={index} x={x} y="0" width={width} height={height} /> : null;
    x += width;
    return bar;
  });
  return (
    <figure className={`barcode ${className}`.trim()}>
      <svg viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Código de barras ${value}`} shapeRendering="crispEdges">{bars}</svg>
      {showText && <figcaption>{value}</figcaption>}
    </figure>
  );
}
