import { useParams } from 'react-router-dom';
import useStoreInfo from '../hooks/useStoreInfo';
import EmptyState from './ui/EmptyState';

export const POLICIES = {
  privacidade: { key: 'privacy', title: 'Política de privacidade' },
  trocas: { key: 'exchanges', title: 'Trocas e devoluções' },
};

// Texto puro definido em Admin → Dados da loja; nunca renderizado como HTML.
export default function PolicyPage() {
  const { slug } = useParams();
  const { storeInfo, loaded } = useStoreInfo();
  const policy = POLICIES[slug];
  const text = policy ? storeInfo.policies[policy.key] : '';
  if (!policy || (loaded && !text)) return <section className="panel"><EmptyState title="Página indisponível" description="Este conteúdo ainda não foi publicado pela loja." /></section>;
  return <article className="panel policy-page">
    <h1>{policy.title}</h1>
    <div className="policy-text">{text}</div>
  </article>;
}
