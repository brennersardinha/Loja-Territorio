export const PERMISSIONS = Object.freeze({
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  CATEGORIES_WRITE: 'categories:write',
  ORDERS_READ: 'orders:read',
  ORDERS_UPDATE_STATUS: 'orders:update_status',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  REPORTS_READ: 'reports:read',
  COUPONS_MANAGE: 'coupons:manage',
  STORE_SETTINGS_MANAGE: 'store_settings:manage',
  REVIEWS_MODERATE: 'reviews:moderate',
  INTEGRATIONS_MANAGE: 'integrations:manage',
  WEBHOOKS_MANAGE: 'webhooks:manage',
  INVENTORY_KEYS_MANAGE: 'inventory_keys:manage',
});

export const ADMIN_ACCESS_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

export const DASHBOARD_ACCESS_PERMISSIONS = Object.freeze([
  PERMISSIONS.ORDERS_READ,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.COUPONS_MANAGE,
  PERMISSIONS.STORE_SETTINGS_MANAGE,
]);
