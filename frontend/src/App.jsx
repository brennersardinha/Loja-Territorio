import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import './styles/tokens.css';
import './App.css';
import StoreSection from './components/StoreSection';
import HomeSection from './components/HomeSection';
import CartSection from './components/CartSection';
import CheckoutSection from './components/CheckoutSection';
import WishlistSection from './components/WishlistSection';
import AdminSection from './components/AdminSection';
import AccountSection from './components/AccountSection';
import ProductsSection from './components/ProductsSection';
import CategoriesSection from './components/CategoriesSection';
import ReviewModerationSection from './components/ReviewModerationSection';
import BrandingSection from './components/BrandingSection';
import IntegrationSection from './components/IntegrationSection';
import MarketingSection from './components/MarketingSection';
import StoreSettingsSection from './components/StoreSettingsSection';
import InventorySection from './components/InventorySection';
import LabelsPrintPage from './components/LabelsPrintPage';
import PolicyPage from './components/PolicyPage';
import MarketingScripts from './components/MarketingScripts';
import RequirePermission from './components/RequirePermission';
import { DASHBOARD_ACCESS_PERMISSIONS, PERMISSIONS } from './config/permissions';
import ClientLayout from './layouts/ClientLayout';
import AdminLayout from './layouts/AdminLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import useCart from './hooks/useCart';
import useCartActions from './hooks/useCartActions';
import useProducts from './hooks/useProducts';
import useCategories from './hooks/useCategories';
import useCheckout from './hooks/useCheckout';
import useAdminOrders from './hooks/useAdminOrders';
import useAdminMetrics from './hooks/useAdminMetrics';
import useWishlist from './hooks/useWishlist';
import useUserOrders from './hooks/useUserOrders';
import useAdminCustomers from './hooks/useAdminCustomers';
import useReviewModeration from './hooks/useReviewModeration';
import useSessionLogout from './hooks/useSessionLogout';
import useFormFields from './hooks/useForms';
import { handleProductPhotosChange } from './hooks/useImageHelpers';
import useSeo from './hooks/useSeo';
import AnalyticsManager from './components/AnalyticsManager';
import StoreAvailability from './components/StoreAvailability';
import { formatAttributeValue } from './utils/formatAttributeValue';

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
const initialCategoryForm = { nome:'',descricao:'',parent_id:'',slug:'',meta_title:'',meta_description:'',imagem:'' };
const initialProductFilters = {
  busca: '',
  categoria_id: '',
  min_preco: '',
  max_preco: '',
};
const initialCheckoutForm = {
  address_id: '',
  shipping_address_text: '',
  shipping_method: 'standard',
  shipping_quote_id: '',
  payment_provider: import.meta.env.DEV ? 'sandbox' : 'stripe',
  payment_method: import.meta.env.DEV ? 'pix' : 'card',
  coupon_code: '',
};
const initialAddressForm = {
  label: '',
  recipient_name: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  is_default: true,
};
const initialAdminMetrics = {
  total_usuarios: 0,
  total_produtos: 0,
  total_categorias: 0,
  total_estoque: 0,
  valor_estoque: 0,
  carrinhos_criados: 0,
  itens_em_carrinhos: 0,
  itens_em_listas_desejos: 0,
  total_vendas: 0,
};

function ProductStoreRoute(props) {
  const { id } = useParams();
  return <StoreSection {...props} productId={Number(id)} />;
}

function AppContent() {
  const {
    mode, setMode, authForm, setAuthForm, profileForm, setProfileForm,
    token, user, status, setStatus, loading, setLoading,
    fetchProfile, submitAuth, requestPasswordReset, resetPassword, submitProfile, clearSession, hasPermission,
  } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  
  const { cartItems, setCartItems, loadGuestCart, saveGuestCart, cartSubtotal, cartItemsCount } = useCart();
  const { fetchCart, mergeGuestCart, addToCart, updateCartItem, removeCartItem } = useCartActions({
    token,
    setStatus,
    setLoading,
    cartItems,
    setCartItems,
    loadGuestCart,
    saveGuestCart,
  });

  const {
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
    editProduct,
    cancelProductEdit,
    fetchProducts,
    fetchProductDetails,
    submitProduct,
    submitProductFilters,
    clearProductFilters,
    changeProductPage,
    deleteProduct,
  } = useProducts({ token, setStatus, setLoading });

  const {
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
  } = useCategories({ token, setStatus, setLoading });

  const {
    checkoutForm,
    setCheckoutForm,
    addressForm,
    setAddressForm,
    addresses,
    setAddresses,
    checkoutPreview,
    setCheckoutPreview,
    checkoutResult,
    setCheckoutResult,
    fetchAddresses,
    submitAddress,
    selectAddress,
    setDefaultAddress,
    removeAddress,
    previewCheckout,
    finalizeCheckout,
    shippingQuotes,
    quoteShipping,
    quotingShipping,
    checkoutError,
  } = useCheckout({ token, setStatus, setLoading, cartItems });

  const {
    customerSearch,
    setCustomerSearch,
    customers,
    setCustomers,
    customerDetail,
    customerEditForm,
    setCustomerEditForm,
    fetchCustomers,
    fetchCustomerDetails,
    submitCustomerEdit,
    selectedCustomer,
  } = useAdminCustomers({ setStatus, setLoading });
  const { wishlistItems, setWishlistItems, fetchWishlist, toggleWishlist } = useWishlist({ token, setStatus });
  const {
    adminMetrics,
    setAdminMetrics,
    topProducts,
    setTopProducts,
    fetchAdminMetrics,
  } = useAdminMetrics({ token, setStatus, setLoading, showToast });
  const {
    adminOrders,
    setAdminOrders,
    adminOrdersPagination,
    setAdminOrdersPagination,
    adminOrderFilters,
    setAdminOrderFilters,
    adminOrderDetail,
    setAdminOrderDetail,
    fetchAdminOrders,
    fetchAdminOrderDetails,
    updateAdminOrderStatus,
  } = useAdminOrders({ token, setStatus, setLoading, showToast });
  const reviewModeration = useReviewModeration({ token, showToast });
  const {
    userOrders,
    userOrderDetail,
    userOrderTracking,
    fetchUserOrders,
    fetchUserOrderTracking,
    resetUserOrdersState,
  } = useUserOrders({ token, setStatus, setLoading });
  const { logout } = useSessionLogout({
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
  });
  const isRegister = mode === 'register';
  useSeo({ pathname: location.pathname, product: selectedProduct });

  useEffect(() => {
    fetchProducts(initialProductFilters, 1);
    fetchCategories();
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile(token);
      // Itens adicionados como visitante entram no carrinho da conta antes de carregá-lo.
      mergeGuestCart(token).then(() => fetchCart(token));
      fetchWishlist(token);
      fetchAddresses(token);
      fetchUserOrders();
    } else {
      setCartItems(loadGuestCart());
      setWishlistItems([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

      if (hasPermission(PERMISSIONS.REPORTS_READ)) {
        fetchAdminMetrics();
      }
      if (hasPermission(PERMISSIONS.CUSTOMERS_READ)) {
        fetchCustomers();
      }
  }, [token, user]);


  const { createChangeHandler } = useFormFields();
  const authFormChange = createChangeHandler(setAuthForm);
  const profileFormChange = createChangeHandler(setProfileForm);
  const productFormChange = createChangeHandler(setProductForm);
  const categoryFormChange = createChangeHandler(setCategoryForm);
  const productFiltersChange = createChangeHandler(setProductFilters);
  const checkoutFormChange = createChangeHandler(setCheckoutForm);
  const addressFormChange = createChangeHandler(setAddressForm, { is_default: (value) => value === 'true' });
  const customerEditFormChange = createChangeHandler(setCustomerEditForm);

  // Image helpers moved to `useImageHelpers.js` and imported at the top of this file.

  function handleProductPhotosChangeWrapped(event) {
    return handleProductPhotosChange(event, setProductForm);
  }

  // Product/category fetching and product details moved to `useProducts` and `useCategories` hooks.

  // Address management moved to `useCheckout` hook.

  // Admin orders logic moved to useAdminOrders hook.

  // Address submit/remove moved to `useCheckout` hook.

  // Checkout preview and finalization moved to `useCheckout` hook.

  // Admin metrics moved to `useAdminMetrics` hook.

  // Product/category submit/delete/edit logic moved to hooks (`useProducts`, `useCategories`).

  // Product filter and pagination handlers are provided by `useProducts` hook.

  function formatPrice(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('pt-BR');
  }

  function renderAttributes(attributes) {
    const entries = Object.entries(attributes || {});

    if (entries.length === 0) {
      return <p className="muted-text">Sem atributos adicionais.</p>;
    }

    return (
      <dl className="attributes-list">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{formatAttributeValue(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const clientPage = (content) => (
    <StoreAvailability><ClientLayout user={user} onLogout={logout} cartCount={cartItemsCount()} categories={categories}>
      {content}
    </ClientLayout></StoreAvailability>
  );

  const adminPage = (content) => (
    <AdminLayout user={user} onLogout={logout}>{content}</AdminLayout>
  );

  const authorizedAdminPage = (permissions, content) => {
    return <RequirePermission anyOf={permissions}>{adminPage(content)}</RequirePermission>;
  };

  const storeSectionProps = {
    products,
    categories,
    selectedProduct,
    productError,
    productFilters,
    productPagination,
    onFiltersChange: productFiltersChange,
    setProductFilters,
    submitProductFilters,
    clearProductFilters,
    addToCart,
    toggleWishlist,
    fetchProductDetails,
    fetchProducts,
    formatPrice,
    renderAttributes,
    changeProductPage,
    deleteProduct,
    token,
    user,
    loading,
    setStatus,
  };

  return (
    <>
      <AnalyticsManager />
      <MarketingScripts />
      <Routes>
        <Route path="/" element={clientPage(
        <HomeSection products={products} categories={categories} loading={loading} error={productError} formatPrice={formatPrice} addToCart={addToCart} toggleWishlist={toggleWishlist} />
        )} />

        <Route path="/buscar" element={clientPage(
        <StoreSection {...storeSectionProps} />
        )} />

        <Route path="/produto/:id/:slug" element={clientPage(
        <ProductStoreRoute {...storeSectionProps} />
        )} />

        <Route path="/carrinho" element={clientPage(
        <CartSection
          cartItems={cartItems}
          cartSubtotal={cartSubtotal}
          formatPrice={formatPrice}
          updateCartItem={updateCartItem}
          removeCartItem={removeCartItem}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          couponCode={checkoutForm.coupon_code}
          onCouponChange={(coupon_code) => setCheckoutForm((current) => ({ ...current, coupon_code }))}
        />
        )} />

        <Route path="/checkout" element={clientPage(
        <CheckoutSection
          loading={loading}
          token={token}
          user={user}
          cartItems={cartItems}
          checkoutForm={checkoutForm}
          setCheckoutForm={setCheckoutForm}
          addressForm={addressForm}
          setAddressForm={setAddressForm}
          addresses={addresses}
          submitAddress={submitAddress}
          selectAddress={selectAddress}
          removeAddress={removeAddress}
          previewCheckout={previewCheckout}
          finalizeCheckout={finalizeCheckout}
          shippingQuotes={shippingQuotes}
          quoteShipping={quoteShipping}
          quotingShipping={quotingShipping}
          checkoutPreview={checkoutPreview}
          setCheckoutPreview={setCheckoutPreview}
          checkoutResult={checkoutResult}
          checkoutError={checkoutError}
          formatPrice={formatPrice}
          formatDateTime={formatDateTime}
          onCheckoutChange={checkoutFormChange}
          onAddressChange={addressFormChange}
          cartSubtotal={cartSubtotal}
        />
        )} />

        <Route path="/desejos" element={clientPage(
        <WishlistSection
          user={user}
          wishlistItems={wishlistItems}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          formatPrice={formatPrice}
        />
        )} />

        <Route path="/admin" element={authorizedAdminPage(DASHBOARD_ACCESS_PERMISSIONS,
        <AdminSection
          adminMetrics={adminMetrics}
          topProducts={topProducts}
          fetchAdminMetrics={fetchAdminMetrics}
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          fetchCustomers={fetchCustomers}
          customers={customers}
          fetchCustomerDetails={fetchCustomerDetails}
          customerDetail={customerDetail}
          customerEditForm={customerEditForm}
          submitCustomerEdit={submitCustomerEdit}
          selectedCustomer={selectedCustomer}
          loading={loading}
          onCustomerEditChange={customerEditFormChange}
          formatPrice={formatPrice}
          formatDateTime={formatDateTime}
          adminOrders={adminOrders}
          adminOrdersPagination={adminOrdersPagination}
          fetchAdminOrders={fetchAdminOrders}
          fetchAdminOrderDetails={fetchAdminOrderDetails}
          adminOrderDetail={adminOrderDetail}
          updateAdminOrderStatus={updateAdminOrderStatus}
          user={user}
          token={token}
          adminOrderFilters={adminOrderFilters}
          setAdminOrderFilters={setAdminOrderFilters}
        />
        )} />

        <Route path="/conta" element={clientPage(
        <AccountSection
          user={user}
          isRegister={isRegister}
          mode={mode}
          setMode={setMode}
          authForm={authForm}
          profileForm={profileForm}
          onAuthFormChange={authFormChange}
          onProfileFormChange={profileFormChange}
          submitAuth={submitAuth}
          requestPasswordReset={requestPasswordReset}
          resetPassword={resetPassword}
          submitProfile={submitProfile}
          loading={loading}
          status={status}
          formatPrice={formatPrice}
          formatDateTime={formatDateTime}
          userOrders={userOrders}
          fetchUserOrders={fetchUserOrders}
          userOrderDetail={userOrderDetail}
          userOrderTracking={userOrderTracking}
          fetchUserOrderTracking={fetchUserOrderTracking}
          addresses={addresses}
          addressForm={addressForm}
          setAddressForm={setAddressForm}
          submitAddress={submitAddress}
          removeAddress={removeAddress}
          setDefaultAddress={setDefaultAddress}
        />
        )} />

        <Route path="/admin/produtos" element={authorizedAdminPage([PERMISSIONS.PRODUCTS_WRITE],
        <ProductsSection
          editingProductId={editingProductId}
          productForm={productForm}
          categories={categories}
          onProductFormChange={productFormChange}
          handleProductPhotosChange={handleProductPhotosChangeWrapped}
          submitProduct={submitProduct}
          loading={loading}
          products={products}
          editProduct={editProduct}
          cancelProductEdit={cancelProductEdit}
          deleteProduct={deleteProduct}
          initialProductForm={initialProductForm}
        />
        )} />

        <Route path="/admin/categorias" element={authorizedAdminPage([PERMISSIONS.CATEGORIES_WRITE],
        <CategoriesSection
          editingCategoryId={editingCategoryId}
          categoryForm={categoryForm}
          categories={categories}
          onCategoryFormChange={categoryFormChange}
          submitCategory={submitCategory}
          editCategory={editCategory}
          deleteCategory={deleteCategory}
          loading={loading}
          setEditingCategoryId={setEditingCategoryId}
          setCategoryForm={setCategoryForm}
          initialCategoryForm={initialCategoryForm}
        />
        )} />
        <Route path="/admin/avaliacoes" element={authorizedAdminPage([PERMISSIONS.REVIEWS_MODERATE],
        <ReviewModerationSection
          {...reviewModeration}
          formatDateTime={formatDateTime}
        />
        )} />
        <Route path="/admin/branding" element={authorizedAdminPage([PERMISSIONS.STORE_SETTINGS_MANAGE],
          <BrandingSection token={token} showToast={showToast} />
        )} />
        <Route path="/admin/integracoes" element={authorizedAdminPage([PERMISSIONS.INTEGRATIONS_MANAGE], <IntegrationSection token={token} showToast={showToast} />)} />
        <Route path="/admin/marketing" element={authorizedAdminPage([PERMISSIONS.STORE_SETTINGS_MANAGE], <MarketingSection token={token} showToast={showToast} />)} />
        <Route path="/admin/loja" element={authorizedAdminPage([PERMISSIONS.STORE_SETTINGS_MANAGE], <StoreSettingsSection token={token} showToast={showToast} />)} />
        {/* Folha de impressão sem o menu do admin: só as etiquetas e a barra de ajustes. */}
        <Route path="/admin/etiquetas" element={<RequirePermission anyOf={[PERMISSIONS.ORDERS_UPDATE_STATUS]}><LabelsPrintPage token={token} /></RequirePermission>} />
        <Route path="/admin/estoque" element={authorizedAdminPage([PERMISSIONS.INVENTORY_KEYS_MANAGE], <InventorySection token={token} showToast={showToast} />)} />
        <Route path="/politicas/:slug" element={clientPage(<PolicyPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
