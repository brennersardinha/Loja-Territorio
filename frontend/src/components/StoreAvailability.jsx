import { useBranding } from '../contexts/BrandingContext';
import { useLocation } from 'react-router-dom';

export default function StoreAvailability({ children }) {
  const { loading, storeState } = useBranding();
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return children;
  // Mantem o shell renderizado durante a resolucao para evitar uma tela em
  // branco e preservar a hidratacao; estados de bloqueio substituem a loja.
  if (storeState === 'unavailable') return <main className="store-status"><h1>Não foi possível abrir a loja</h1><p>Tente novamente em alguns instantes.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>;
  return children;
}
