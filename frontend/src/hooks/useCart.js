import { useState, useCallback } from 'react';

const GUEST_CART_KEY = 'guestCartItems';

export default function useCart(initial = []) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
    } catch (e) {
      return initial;
    }
  });

  const loadGuestCart = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }, []);

  const saveGuestCart = useCallback((items) => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    } catch (e) {
      // ignore storage errors
    }
    setCartItems(items);
  }, []);

  const cartSubtotal = useCallback((items = cartItems) => {
    return items.reduce(
      (total, item) => total + Number(item.preco_unitario || item.preco || 0) * Number(item.quantidade || 0),
      0,
    );
  }, [cartItems]);

  const cartItemsCount = useCallback((items = cartItems) => {
    return items.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  }, [cartItems]);

  return {
    cartItems,
    setCartItems,
    loadGuestCart,
    saveGuestCart,
    cartSubtotal,
    cartItemsCount,
  };
}
