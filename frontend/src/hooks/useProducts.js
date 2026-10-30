import { useState, useCallback } from 'react';
import { fileToImageDataUrl } from './useImageHelpers';
import { validatePriceFilters, validateProductForm } from '../utils/formValidation';

const initialProductForm = {
  nome: '',
  descricao: '',
  preco: '',
  estoque: '',
  categoria_id: '',
  fotos_produto_files: [],
  fotos_produto: [],
  atributos_dinamicos: '{}',
  foto_exibicao_fit: 'cover',
  foto_exibicao_position: 'center',
  slug:'',meta_title:'',meta_description:'',
  sku:'',peso_kg:'0.3',altura_cm:'10',largura_cm:'15',comprimento_cm:'20',
};

const initialProductFilters = {
  busca: '',
  categoria_id: '',
  min_preco: '',
  max_preco: '',
};

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
    return data;
  });
}

export default function useProducts({ token, setStatus, setLoading } = {}) {
  const [productForm, setProductForm] = useState(initialProductForm);
  const [productFilters, setProductFilters] = useState(initialProductFilters);
  const [products, setProducts] = useState([]);
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 12, total: 0, total_pages: 0 });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productError, setProductError] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);

  const authHeaders = useCallback((currentToken = token) => ({ Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' }), [token]);

  function buildProductsUrl(filters = productFilters, page = 1) {
    const params = new URLSearchParams({ page: String(page), limit: String(productPagination.limit) });
    Object.entries(filters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
    return `/api/products?${params.toString()}`;
  }

  const fetchProducts = useCallback(async (filters = productFilters, page = 1) => {
    try {
      setProductError('');
      setLoading?.(true);
      const response = await fetch(buildProductsUrl(filters, page));
      const data = await parseResponse(response);
      setProducts(data.items || data);
      setProductPagination(data.pagination || { page: 1, limit: data.length || productPagination.limit, total: data.length || 0, total_pages: 1 });
    } catch (error) {
      setProductError(error.message);
      setStatus?.(error.message);
    } finally {
      setLoading?.(false);
    }
  }, [productFilters, productPagination.limit, setLoading, setStatus]);

  const fetchProductDetails = useCallback(async (id) => {
    try {
      setLoading?.(true);
      setStatus?.('Carregando detalhes do produto...');
      const response = await fetch(`/api/products/${id}`);
      const data = await parseResponse(response);
      setSelectedProduct(data.product);
      setStatus?.('Produto carregado.');
      return data.product;
    } catch (error) {
      setStatus?.(error.message);
      return null;
    } finally {
      setLoading?.(false);
    }
  }, [setLoading, setStatus]);

  function editProduct(product) {
    setEditingProductId(product.id);
    setProductForm({
      nome: product.nome || '',
      descricao: product.descricao || '',
      preco: product.preco !== undefined && product.preco !== null ? String(product.preco) : '',
      estoque: product.estoque !== undefined && product.estoque !== null ? String(product.estoque) : '',
      categoria_id: product.categoria_id || '',
      fotos_produto_files: [],
      fotos_produto: Array.isArray(product.fotos_produto) ? product.fotos_produto : [],
      atributos_dinamicos: JSON.stringify(product.atributos_dinamicos || {}, null, 2),
      foto_exibicao_fit: product.foto_exibicao_fit || 'cover',
      foto_exibicao_position: product.foto_exibicao_position || 'center',
      slug:product.slug||'',meta_title:product.meta_title||'',meta_description:product.meta_description||'',
      sku:product.sku||'',peso_kg:String(product.peso_kg||0.3),altura_cm:String(product.altura_cm||10),largura_cm:String(product.largura_cm||15),comprimento_cm:String(product.comprimento_cm||20),
    });
  }

  function cancelProductEdit() {
    setEditingProductId(null);
    setProductForm(initialProductForm);
  }

  const submitProduct = useCallback(async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    const validationError = validateProductForm(productForm);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }
    setLoading?.(true);
    const isEditingProduct = editingProductId !== null;
    setStatus?.(isEditingProduct ? 'Atualizando produto...' : 'Cadastrando produto...');

    try {
      const newPhotos = (productForm.fotos_produto_files || []).length > 0
        ? await Promise.all((productForm.fotos_produto_files || []).map((file) => fileToImageDataUrl(file)))
        : (productForm.fotos_produto || []);
      const atributos_dinamicos = JSON.parse(productForm.atributos_dinamicos || '{}');
      const payload = { ...productForm, preco: Number(productForm.preco), estoque: Number(productForm.estoque), categoria_id: productForm.categoria_id || null, fotos_produto: newPhotos, atributos_dinamicos };

      const response = await fetch(isEditingProduct ? `/api/products/${editingProductId}` : '/api/products', {
        method: isEditingProduct ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload),
      });
      await parseResponse(response);

      cancelProductEdit();
      await fetchProducts(productFilters, productPagination.page);
      setStatus?.(isEditingProduct ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
    } catch (error) {
      setStatus?.(error.message.includes('JSON') ? 'Atributos dinâmicos devem conter JSON válido.' : error.message);
    } finally {
      setLoading?.(false);
    }
  }, [editingProductId, productForm, fetchProducts, productFilters, productPagination.page, setLoading, setStatus, authHeaders]);

  function submitProductFilters(event) {
    if (event && event.preventDefault) event.preventDefault();
    const validationError = validatePriceFilters(productFilters);
    if (validationError) {
      setStatus?.(validationError);
      return;
    }
    fetchProducts(productFilters, 1);
  }

  function clearProductFilters(event) {
    if (event && event.preventDefault) event.preventDefault();
    setProductFilters(initialProductFilters);
    fetchProducts(initialProductFilters, 1);
  }

  function changeProductPage(page) {
    fetchProducts(productFilters, page);
  }

  async function deleteProduct(id) {
    setLoading?.(true);
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: authHeaders() });
      await parseResponse(response);
      if (editingProductId === id) cancelProductEdit();
      await fetchProducts(productFilters, productPagination.page);
      setStatus?.('Produto removido com sucesso.');
      return true;
    } catch (error) {
      setStatus?.(error.message);
      return false;
    } finally {
      setLoading?.(false);
    }
  }

  return {
    productForm,
    setProductForm,
    productFilters,
    setProductFilters,
    products,
    setProducts,
    productPagination,
    setProductPagination,
    selectedProduct,
    productError,
    setSelectedProduct,
    editingProductId,
    setEditingProductId,
    editProduct,
    cancelProductEdit,
    fetchProducts,
    fetchProductDetails,
    submitProduct,
    submitProductFilters,
    clearProductFilters,
    changeProductPage,
    deleteProduct,
  };
}
