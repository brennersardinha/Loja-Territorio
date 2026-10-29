const { ROLES, PERMISSIONS, getPermissions } = require('../src/config/rbac');
const { resolveUserRole } = require('../src/routes/user.routes');

describe('matriz de autorizacao da loja unica', () => {
  test.each(Object.values(PERMISSIONS))('dono possui %s', (permission) => {
    expect(getPermissions(ROLES.ADMIN)).toContain(permission);
  });

  test('cliente nao possui permissoes administrativas', () => {
    expect(getPermissions(ROLES.CUSTOMER)).toEqual([]);
  });

  test.each([
    ['owner', ROLES.ADMIN],
    ['customer', ROLES.CUSTOMER],
    [undefined, ROLES.CUSTOMER],
    // Papeis de equipe da plataforma nao existem na loja e nunca concedem acesso.
    ['admin', ROLES.CUSTOMER],
    ['manager', ROLES.CUSTOMER],
  ])('membership %s resolve para %s', (membershipRole, expected) => {
    expect(resolveUserRole({ membership_role: membershipRole })).toBe(expected);
  });

  test('flags legadas de usuario nao concedem acesso administrativo', () => {
    expect(resolveUserRole({ membership_role: 'customer', is_admin: true, role: 'admin' })).toBe(ROLES.CUSTOMER);
  });
});
