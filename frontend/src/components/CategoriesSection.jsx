import { useMemo, useState } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import { fileToImageDataUrl } from '../hooks/useImageHelpers';

export default function CategoriesSection({
  editingCategoryId,
  categoryForm,
  categories,
  onCategoryFormChange,
  submitCategory,
  editCategory,
  deleteCategory,
  loading,
  setEditingCategoryId,
  setCategoryForm,
  initialCategoryForm,
}) {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = useMemo(() => categories.filter((category) => category.nome.toLowerCase().includes(search.toLowerCase())), [categories, search]);
  const confirmDelete = async () => { await deleteCategory(deleteTarget.id); setDeleteTarget(null); };
  const changeImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const imagem = await fileToImageDataUrl(file);
    setCategoryForm((current) => ({ ...current, imagem }));
  };
  return (
    <section className="panel wide-panel admin-categories-page">
      <div className="panel-header"><div><span className="eyebrow">Organização do catálogo</span><h2>{editingCategoryId ? 'Editar categoria' : 'Gerenciar categorias'}</h2></div><Badge variant="neutral">{categories.length} categorias</Badge></div>
      <form className="form-grid two-columns" onSubmit={submitCategory}>
        <label>Nome<input name="nome" value={categoryForm.nome} onChange={onCategoryFormChange} minLength="2" required /></label>
        <label>Categoria pai<select name="parent_id" value={categoryForm.parent_id} onChange={onCategoryFormChange}><option value="">Sem categoria pai</option>{categories.filter((category) => category.id !== editingCategoryId).map((category) => (<option key={category.id} value={category.id}>{category.nome}</option>))}</select></label>
        <label className="full-span">Descrição<textarea name="descricao" rows="3" value={categoryForm.descricao} onChange={onCategoryFormChange} /></label>
        <label className="full-span">Imagem da categoria<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeImage} /><small className="muted-text">Aparece no cartão da categoria na página inicial. Prefira fotos horizontais.</small>{categoryForm.imagem && <span className="branding-media-item"><img src={categoryForm.imagem} alt="Prévia da imagem da categoria" /><Button variant="ghost" size="sm" onClick={() => setCategoryForm((current) => ({ ...current, imagem: '' }))}>Remover imagem</Button></span>}</label>
        <label>URL slug<input name="slug" value={categoryForm.slug} onChange={onCategoryFormChange}/></label><label>Meta title<input name="meta_title" maxLength="70" value={categoryForm.meta_title} onChange={onCategoryFormChange}/></label><label className="full-span">Meta description<input name="meta_description" maxLength="160" value={categoryForm.meta_description} onChange={onCategoryFormChange}/></label>
        <div className="button-row">
          <Button type="submit" loading={loading}>{editingCategoryId ? 'Salvar alterações' : 'Cadastrar categoria'}</Button>
          {editingCategoryId && (
            <button className="ghost-button" type="button" onClick={() => { setEditingCategoryId(null); setCategoryForm(initialCategoryForm); }}>Cancelar</button>
          )}
        </div>
      </form>

      <label className="category-search">Buscar categorias<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite o nome" /></label>
      {filtered.length > 0 ? <div className="table-wrap">
        <table>
          <thead><tr><th>Categoria</th><th>Pai</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map((category) => (
              <tr key={category.id}>
                <td>{category.nome}</td>
                <td>{category.parent_nome || 'Sem categoria pai'}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost-button compact" type="button" onClick={() => editCategory(category)}>Editar</button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget(category)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : <EmptyState title="Nenhuma categoria encontrada" description="Revise a busca ou cadastre uma nova categoria." actionLabel="Limpar busca" onAction={() => setSearch('')} />}
      <Modal open={Boolean(deleteTarget)} title="Excluir categoria?" description={deleteTarget ? `“${deleteTarget.nome}” será removida. Produtos associados podem ficar sem categoria.` : ''} confirmLabel="Excluir categoria" danger loading={loading} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </section>
  );
}
