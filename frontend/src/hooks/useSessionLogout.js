export default function useSessionLogout({
  token,
  clearSession,
  loadGuestCart,
  setCartItems,
  setWishlistItems,
  setAddresses,
  resetUserOrdersState,
  setCheckoutPreview,
  setCheckoutResult,
  setStatus,
} = {}) {
  async function logout() {
    if (token) {
      await fetch('/api/logout', { method: 'POST', headers: { 'X-CSRF-Token': token } }).catch(() => null);
    }

    clearSession?.();
    setCartItems?.(loadGuestCart?.() || []);
    setWishlistItems?.([]);
    setAddresses?.([]);
    resetUserOrdersState?.();
    setCheckoutPreview?.(null);
    setCheckoutResult?.(null);
    setStatus?.('Sessao encerrada.');
  }

  return { logout };
}
