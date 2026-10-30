import { useCallback, useState } from 'react';

function parseResponse(response) {
  return response.json().then((data) => {
    if (!response.ok) throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
    return data;
  });
}

export default function useWishlist({ token, setStatus } = {}) {
  const [wishlistItems, setWishlistItems] = useState([]);

  const authHeaders = useCallback((currentToken = token) => ({
    Authorization: `Bearer ${currentToken}`,
    'Content-Type': 'application/json',
  }), [token]);

  async function fetchWishlist(currentToken = token) {
    if (!currentToken) {
      setWishlistItems([]);
      return;
    }

    try {
      const response = await fetch('/api/wishlist', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await parseResponse(response);
      setWishlistItems(data.items || []);
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  async function toggleWishlist(product) {
    const productId = product.produto_id || product.id;

    if (!token) {
      setStatus?.('Entre na conta para usar a lista de desejos.');
      return;
    }

    const isFavorite = wishlistItems.some((item) => item.produto_id === productId);

    try {
      const response = await fetch(isFavorite ? `/api/wishlist/${productId}` : '/api/wishlist', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: isFavorite ? { Authorization: `Bearer ${token}` } : authHeaders(),
        body: isFavorite ? undefined : JSON.stringify({ produto_id: productId }),
      });
      const data = await parseResponse(response);
      setWishlistItems(data.items || []);
      setStatus?.(isFavorite ? 'Produto removido da lista de desejos.' : 'Produto adicionado a lista de desejos.');
    } catch (error) {
      setStatus?.(error.message);
    }
  }

  return {
    wishlistItems,
    setWishlistItems,
    fetchWishlist,
    toggleWishlist,
  };
}