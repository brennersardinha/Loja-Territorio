// Loja unica: o dono (membership 'owner') e o unico administrador; demais usuarios sao clientes.
const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
});

const PERMISSIONS = Object.freeze({
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
  WEBHOOKS_MANAGE: 'webhooks:manage',
  INTEGRATIONS_MANAGE: 'integrations:manage',
  INVENTORY_KEYS_MANAGE: 'inventory_keys:manage',
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: [],
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
});

function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLES.CUSTOMER];
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, getPermissions };
