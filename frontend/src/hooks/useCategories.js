import { useState } from 'react';
import { validateCategoryForm } from '../utils/formValidation';

const initialCategoryForm = { nome:'',descricao:'',parent_id:'',slug:'',meta_title:'',meta_description:'' };

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.');
    return data;
  });
}

export default function useCategories({ token, setStatus, setLoading } = {}) {
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories');
      const data = await parseResponse(response);
      setCategories(data);
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function submitCategory(event) {
    if (event && event.preventDefault) event.preventDefault();
    const validationError = validateCategoryForm(categoryForm);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }
    setLoading?.(true);
    setStatus?.(editingCategoryId ? 'Atualizando categoria...' : 'Cadastrando categoria...');
    try {
      const response = await fetch(editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories', {
        method: editingCategoryId ? 'PUT' : 'POST', headers: { Authorization:`Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm),
      });
      await parseResponse(response);
      setCategoryForm(initialCategoryForm);
      setEditingCategoryId(null);
      await fetchCategories();
      setStatus?.(editingCategoryId ? 'Categoria atualizada com sucesso.' : 'Categoria cadastrada com sucesso.');
    } catch (error) {
      setStatus?.(error.message);
    } finally {
      setLoading?.(false);
    }
  }

  async function deleteCategory(id) {
    setLoading?.(true);
    setStatus?.('Removendo categoria...');
    try {
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE', headers:{Authorization:`Bearer ${token}`} });
      await parseResponse(response);
      await fetchCategories();
      setStatus?.('Categoria removida com sucesso.');
    } catch (error) {
      setStatus?.(error.message);
    } finally {
      setLoading?.(false);
    }
  }

  function editCategory(category) {
    setEditingCategoryId(category.id);
    setCategoryForm({ nome:category.nome||'',descricao:category.descricao||'',parent_id:category.parent_id||'',slug:category.slug||'',meta_title:category.meta_title||'',meta_description:category.meta_description||'' });
  }

  return {
    categories,
    setCategories,
    categoryForm,
    setCategoryForm,
    editingCategoryId,
    setEditingCategoryId,
    fetchCategories,
    submitCategory,
    deleteCategory,
    editCategory,
  };
}


