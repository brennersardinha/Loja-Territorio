import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import { productPhoto } from './ui/ProductCard';
import { useToast } from '../contexts/ToastContext';

// Produtos: a página mostra só o catálogo; cadastro e edição abrem numa janela sobreposta.
export default function ProductsSection({ editingProductId, productForm, categories, onProductFormChange, handleProductPhotosChange, submitProduct, loading, products, editProduct, cancelProductEdit, deleteProduct }) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorError, setEditorError] = useState('');
  const firstFieldRef = useRef(null);
  const openerRef = useRef(null);
  // Catálogo completo para o admin (a lista compartilhada com a vitrine traz só a primeira página).
  const [catalog, setCatalog] = useState(products);
  const loadCatalog = useCallback(async () => {
    try {
      let all = [];
      for (let page = 1, totalPages = 1; page <= totalPages && page <= 40; page += 1) {
        const response = await fetch(`/api/products?page=${page}&limit=50`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao carregar produtos.');
        all = all.concat(data.items || []);
        totalPages = data.pagination?.total_pages || 1;
      }
      setCatalog(all);
    } catch (error) { showToast(error.message, 'error'); }
  }, [showToast]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  const filtered = useMemo(() => catalog.filter((product) => (!search || `${product.nome} ${product.sku || ''}`.toLowerCase().includes(search.toLowerCase())) && (!category || String(product.categoria_id || '') === category) && (!stock || (stock === 'available' ? Number(product.estoque) > 0 : Number(product.estoque) <= 0))), [catalog, search, category, stock]);
  const confirmDelete = async () => { if (await deleteProduct(deleteTarget.id)) { setDeleteTarget(null); loadCatalog(); } };

  const openEditor = (product = null) => {
    openerRef.current = document.activeElement;
    if (product) editProduct(product); else cancelProductEdit();
    setEditorError('');
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    cancelProductEdit();
    requestAnimationFrame(() => openerRef.current?.focus?.());
  };
  async function save(event) {
    event.preventDefault();
    const editing = editingProductId !== null;
    const result = await submitProduct();
    if (result?.ok) {
      showToast(editing ? 'Produto atualizado.' : 'Produto cadastrado.', 'success');
      setEditorOpen(false);
      loadCatalog();
      requestAnimationFrame(() => openerRef.current?.focus?.());
    } else setEditorError(result?.error || 'Revise os campos e tente novamente.');
  }

  // Janela aberta: foco no primeiro campo, Esc fecha e a página de fundo não rola.
  useEffect(() => {
    if (!editorOpen) return undefined;
    firstFieldRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === 'Escape') closeEditor(); };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = overflow; };
  }, [editorOpen]);

  return <section className="admin-catalog-page">
    <div className="panel-header admin-page-header products-page-header"><div><span className="eyebrow">Catálogo</span><h2>Produtos cadastrados</h2><p className="muted-text">Encontre, edite e remova os itens disponíveis na loja.</p></div><div className="button-row"><Badge variant="neutral">{catalog.length} {catalog.length === 1 ? 'produto' : 'produtos'}</Badge><Button onClick={() => openEditor()}>+ Novo produto</Button></div></div>
      <section className="panel catalog-list-panel" aria-label="Lista de produtos"><span className="result-count">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span><div className="catalog-admin-filters"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou SKU" /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label>Estoque<select value={stock} onChange={(event) => setStock(event.target.value)}><option value="">Todos</option><option value="available">Disponível</option><option value="unavailable">Sem estoque</option></select></label></div>
        {filtered.length ? <div className="admin-product-list">{filtered.map((product) => { const photo = productPhoto(product); const available = Number(product.estoque) > 0; return <article key={product.id} className="admin-product-row"><div className="admin-product-media">{photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">◇</span>}</div><div><strong>{product.nome}</strong>{product.sku && <small className="technical-data">{product.sku}</small>}<span>{categories.find((item) => item.id === product.categoria_id)?.nome || 'Sem categoria'}</span></div><strong className="technical-data">{Number(product.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><Badge variant={available ? 'success' : 'danger'}>{available ? `${product.estoque} em estoque` : 'Sem estoque'}</Badge><div className="row-actions"><Button variant="ghost" size="sm" onClick={() => openEditor(product)}>Editar</Button><Button variant="danger" size="sm" onClick={() => setDeleteTarget(product)}>Excluir</Button></div></article>; })}</div> : <EmptyState title="Nenhum produto encontrado" description={catalog.length ? 'Revise os filtros ou cadastre um novo produto.' : 'Cadastre o primeiro produto da loja.'} actionLabel="Limpar filtros" onAction={() => { setSearch(''); setCategory(''); setStock(''); }} />}
      </section>
    {editorOpen && <div className="admin-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}>
      <section className="admin-sheet" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <header className="admin-sheet-header"><div><span className="eyebrow">Catálogo</span><h2 id="product-form-title">{editingProductId ? 'Editar produto' : 'Novo produto'}</h2></div><Button variant="ghost" size="sm" onClick={closeEditor} aria-label="Fechar formulário">Fechar ✕</Button></header>
        <div className="admin-sheet-body">
          {editorError && <Alert variant="error" title="Não foi possível salvar">{editorError}</Alert>}
        <form id="product-form" className="form-grid two-columns" onSubmit={save}>
          <label className="full-span">Nome<input ref={firstFieldRef} name="nome" value={productForm.nome} onChange={onProductFormChange} minLength="2" required /></label><label>Preço<input name="preco" type="number" min="0" step="0.01" value={productForm.preco} onChange={onProductFormChange} required /></label><label>Estoque<input name="estoque" type="number" min="0" step="1" value={productForm.estoque} onChange={onProductFormChange} required /></label><label>SKU<input className="technical-data" name="sku" maxLength="80" value={productForm.sku} onChange={onProductFormChange} /></label><label>Categoria<select name="categoria_id" value={productForm.categoria_id} onChange={onProductFormChange}><option value="">Sem categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label className="full-span">Descrição<textarea name="descricao" rows="4" value={productForm.descricao} onChange={onProductFormChange} /></label>
          <fieldset className="full-span product-admin-group"><legend>Dimensões para entrega</legend><div className="form-grid two-columns"><label>Peso (kg)<input name="peso_kg" type="number" min="0.001" step="0.001" value={productForm.peso_kg} onChange={onProductFormChange} required /></label><label>Altura (cm)<input name="altura_cm" type="number" min="0.01" step="0.01" value={productForm.altura_cm} onChange={onProductFormChange} required /></label><label>Largura (cm)<input name="largura_cm" type="number" min="0.01" step="0.01" value={productForm.largura_cm} onChange={onProductFormChange} required /></label><label>Comprimento (cm)<input name="comprimento_cm" type="number" min="0.01" step="0.01" value={productForm.comprimento_cm} onChange={onProductFormChange} required /></label></div></fieldset>
          <fieldset className="full-span product-admin-group"><legend>Imagens</legend><label className="upload-dropzone">Selecionar fotos<input name="fotos_produto_files" type="file" accept="image/*" multiple onChange={handleProductPhotosChange} required={!(productForm.fotos_produto || []).length} title="Adicione ao menos uma foto: produtos sem foto vendem menos." /><span>{(productForm.fotos_produto_files || []).length ? `${productForm.fotos_produto_files.length} arquivo(s) selecionado(s)` : 'PNG, JPG ou WEBP · múltiplos arquivos'}</span></label><div className="form-grid two-columns"><label>Enquadramento<select name="foto_exibicao_fit" value={productForm.foto_exibicao_fit} onChange={onProductFormChange}><option value="cover">Cortar para preencher</option><option value="contain">Sem cortar</option><option value="fill">Esticar</option><option value="scale-down">Reduzir</option></select></label><label>Posição<select name="foto_exibicao_position" value={productForm.foto_exibicao_position} onChange={onProductFormChange}><option value="center">Centro</option><option value="top">Topo</option><option value="bottom">Base</option><option value="left">Esquerda</option><option value="right">Direita</option></select></label></div></fieldset>
          <details className="full-span advanced-fields"><summary>SEO e atributos avançados</summary><div className="form-grid"><label>URL slug<input name="slug" value={productForm.slug} onChange={onProductFormChange} /></label><label>Meta title<input name="meta_title" maxLength="70" value={productForm.meta_title} onChange={onProductFormChange} /></label><label>Meta description<input name="meta_description" maxLength="160" value={productForm.meta_description} onChange={onProductFormChange} /></label><label>Atributos dinâmicos (JSON)<textarea className="technical-data" name="atributos_dinamicos" rows="6" value={productForm.atributos_dinamicos} onChange={onProductFormChange} required /></label></div></details>
        </form>
        </div>
        <footer className="admin-sheet-footer"><Button variant="ghost" onClick={closeEditor} disabled={loading}>Cancelar</Button><Button type="submit" form="product-form" loading={loading}>{editingProductId ? 'Salvar alterações' : 'Cadastrar produto'}</Button></footer>
      </section>
    </div>}
    <Modal open={Boolean(deleteTarget)} title="Excluir produto?" description={deleteTarget ? `“${deleteTarget.nome}” será removido permanentemente do catálogo.` : ''} confirmLabel="Excluir produto" danger loading={loading} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
  </section>;
}
