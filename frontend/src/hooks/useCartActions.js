import { analyticsItem, trackEvent } from '../utils/analytics';

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Nao foi possivel concluir a acao.');
    return data;
  });
}

export default function useCartActions({
  token,
  setStatus,
  setLoading,
  cartItems,
  setCartItems,
  loadGuestCart,
  saveGuestCart,
} = {}) {
  const authHeaders = (currentToken = token) => ({
    Authorization: `Bearer ${currentToken}`,
    'Content-Type': 'application/json',
  });

  async function fetchCart(currentToken = token) {
    if (!currentToken) {
      return;
    }

    try {
      const response = await fetch('/api/cart', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await parseResponse(response);
      setCartItems(data.items || []);
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function addToCart(product, quantidade = 1) {
    const productId = product.produto_id || product.id;

    if (token) {
      setLoading?.(true);
      setStatus?.('Adicionando produto ao carrinho...');

      try {
        const response = await fetch('/api/cart/add', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ produto_id: productId, quantidade }),
        });
        const data = await parseResponse(response);
        setCartItems(data.items || []);
        setStatus?.('Produto adicionado ao carrinho.');
        trackEvent('add_to_cart', {
          currency: 'BRL',
          value: Number(product.preco || product.preco_atual || 0) * quantidade,
          items: [analyticsItem(product, quantidade)],
        });
      } catch (error) {
        setStatus?.(error.message);
        return false;
      } finally {
        setLoading?.(false);
      }

      return true;
    }

    const currentCart = loadGuestCart();
    const existing = currentCart.find((item) => item.produto_id === productId);
    const nextQuantity = (existing?.quantidade || 0) + quantidade;

    if (nextQuantity > Number(product.estoque || 0)) {
      setStatus?.('Quantidade solicitada excede o estoque disponivel.');
      return false;
    }

    const nextCart = existing
      ? currentCart.map((item) => (
        item.produto_id === productId ? { ...item, quantidade: nextQuantity } : item
      ))
      : [
        ...currentCart,
        {
          id: `guest-${productId}`,
          produto_id: productId,
          nome: product.nome,
          descricao: product.descricao,
          preco_unitario: product.preco || product.preco_atual,
          preco_atual: product.preco || product.preco_atual,
          estoque: product.estoque,
          categoria_nome: product.categoria_nome,
          fotos_produto: product.fotos_produto || [],
          foto_exibicao_fit: product.foto_exibicao_fit,
          foto_exibicao_position: product.foto_exibicao_position,
          quantidade,
        },
      ];

    saveGuestCart(nextCart);
    setStatus?.('Produto adicionado ao carrinho local.');
    trackEvent('add_to_cart', {
      currency: 'BRL',
      value: Number(product.preco || product.preco_atual || 0) * quantidade,
      items: [analyticsItem(product, quantidade)],
    });
    return true;
  }

  async function updateCartItem(item, quantidade) {
    const nextQuantity = Number(quantidade);

    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      setStatus?.('Quantidade deve ser um inteiro positivo.');
      return;
    }

    if (token) {
      try {
        const response = await fetch(`/api/cart/update/${item.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ quantidade: nextQuantity }),
        });
        const data = await parseResponse(response);
        setCartItems(data.items || []);
        setStatus?.('Carrinho atualizado.');
      } catch (error) {
        setStatus?.(error.message);
      }

      return;
    }

    if (nextQuantity > Number(item.estoque || 0)) {
      setStatus?.('Quantidade solicitada excede o estoque disponivel.');
      return;
    }

    saveGuestCart(cartItems.map((current) => (
      current.produto_id === item.produto_id ? { ...current, quantidade: nextQuantity } : current
    )));
    setStatus?.('Carrinho local atualizado.');
  }

  async function removeCartItem(item) {
    if (token) {
      try {
        const response = await fetch(`/api/cart/remove/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseResponse(response);
        setCartItems(data.items || []);
        setStatus?.('Item removido do carrinho.');
      } catch (error) {
        setStatus?.(error.message);
      }

      return;
    }

    saveGuestCart(cartItems.filter((current) => current.produto_id !== item.produto_id));
    setStatus?.('Item removido do carrinho local.');
  }

  return {
    fetchCart,
    addToCart,
    updateCartItem,
    removeCartItem,
  };
}
