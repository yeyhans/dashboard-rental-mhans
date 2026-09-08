import { describe, expect, it } from 'vitest';

import {
  ADMIN_HOME,
  ADMIN_ROLES,
  FORBIDDEN_ROLE_ERROR,
  INACTIVE_ACCOUNT_ERROR,
  OPERATOR_HOME,
  hasFullAccess,
  homeFor,
  isAdminRole,
  resolveAccess,
  resolveLanding,
} from '../accessControl';

/**
 * Role × path gating for the dashboard.
 *
 * The rules live here, in a pure module, because `src/middleware/index.ts` imports
 * `astro:middleware` — a virtual module vitest cannot resolve — so the middleware itself is not
 * unit-testable. Both the global middleware (pages) and `withAuth` (APIs) call `resolveAccess`
 * and act on its verdict; a wrong verdict here is a wrong door in production.
 *
 * `operator` is the garage worker: scans asset tags in and out, nothing else. `admin` and
 * `super_admin` keep the whole dashboard and can also use the garage screens.
 */
describe('ADMIN_ROLES', () => {
  it('names exactly the three roles the CHECK constraint accepts', () => {
    expect([...ADMIN_ROLES].sort()).toEqual(['admin', 'operator', 'super_admin']);
  });

  it('isAdminRole is a type guard over that list', () => {
    expect(isAdminRole('operator')).toBe(true);
    expect(isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('root')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(42)).toBe(false);
  });

  it('only admin and super_admin have full access', () => {
    expect(hasFullAccess('admin')).toBe(true);
    expect(hasFullAccess('super_admin')).toBe(true);
    expect(hasFullAccess('operator')).toBe(false);
    expect(hasFullAccess('')).toBe(false);
  });
});

describe('homeFor', () => {
  it('sends operators to the garage and everyone else to the control centre', () => {
    expect(homeFor('operator')).toBe(OPERATOR_HOME);
    expect(homeFor('admin')).toBe(ADMIN_HOME);
    expect(homeFor('super_admin')).toBe(ADMIN_HOME);
  });

  it('is /bodega and /dashboard, matching the routes that exist', () => {
    expect(OPERATOR_HOME).toBe('/bodega');
    expect(ADMIN_HOME).toBe('/dashboard');
  });
});

describe('resolveLanding (R3-103)', () => {
  it('the server value wins', () => {
    expect(resolveLanding('/bodega', '/dashboard')).toBe('/bodega');
  });

  it('falls back to the prop when the server sent nothing', () => {
    expect(resolveLanding(undefined, '/orders')).toBe('/orders');
    expect(resolveLanding('', '/orders')).toBe('/orders');
    expect(resolveLanding('   ', '/orders')).toBe('/orders');
    expect(resolveLanding(null, '/orders')).toBe('/orders');
  });

  it('lands on /dashboard when both are empty', () => {
    expect(resolveLanding(undefined, undefined)).toBe('/dashboard');
    expect(resolveLanding('', '')).toBe('/dashboard');
  });
});

describe('resolveAccess — admin and super_admin', () => {
  const everything = [
    ['GET', '/dashboard'],
    ['GET', '/orders/123'],
    ['GET', '/inventory/movements'],
    ['GET', '/operators'],
    ['GET', '/bodega'],
    ['GET', '/bodega/orden/55'],
    ['GET', '/api/inventory/movements?since=2026-09-08'],
    ['PATCH', '/api/operators/3'],
    ['DELETE', '/api/products/9'],
  ] as const;

  it.each(everything)('%s %s → allow for admin', (method, path) => {
    expect(resolveAccess('admin', path, method)).toBe('allow');
  });

  it.each(everything)('%s %s → allow for super_admin', (method, path) => {
    expect(resolveAccess('super_admin', path, method)).toBe('allow');
  });
});

describe('resolveAccess — operator pages', () => {
  it('allows the garage screens', () => {
    expect(resolveAccess('operator', '/bodega')).toBe('allow');
    expect(resolveAccess('operator', '/bodega/')).toBe('allow');
    expect(resolveAccess('operator', '/bodega/orden/55')).toBe('allow');
  });

  it('allows login, logout and the root (which the middleware then redirects home)', () => {
    expect(resolveAccess('operator', '/login')).toBe('allow');
    expect(resolveAccess('operator', '/logout')).toBe('allow');
    expect(resolveAccess('operator', '/')).toBe('allow');
  });

  it('allows static assets — the garage page needs its own CSS and islands', () => {
    expect(resolveAccess('operator', '/_astro/BodegaScanner.abc123.js')).toBe('allow');
    expect(resolveAccess('operator', '/favicon.ico')).toBe('allow');
    expect(resolveAccess('operator', '/manifest.webmanifest')).toBe('allow');
  });

  it('redirects every other page — including prefix look-alikes', () => {
    expect(resolveAccess('operator', '/dashboard')).toBe('redirect');
    expect(resolveAccess('operator', '/orders/123')).toBe('redirect');
    expect(resolveAccess('operator', '/inventory')).toBe('redirect');
    expect(resolveAccess('operator', '/inventory/movements')).toBe('redirect');
    expect(resolveAccess('operator', '/operators')).toBe('redirect');
    // `/bodegas` is NOT `/bodega`; without the separator the prefix lies.
    expect(resolveAccess('operator', '/bodegas')).toBe('redirect');
    expect(resolveAccess('operator', '/bodega-admin')).toBe('redirect');
  });
});

describe('resolveAccess — operator APIs', () => {
  it('allows exactly the scan path: asset lookup, movement recording, garage endpoints', () => {
    expect(resolveAccess('operator', '/api/inventory/assets', 'GET')).toBe('allow');
    expect(resolveAccess('operator', '/api/inventory/assets?tag=MH-00001', 'GET')).toBe('allow');
    expect(resolveAccess('operator', '/api/inventory/movements', 'POST')).toBe('allow');
    expect(resolveAccess('operator', '/api/bodega/board', 'GET')).toBe('allow');
    expect(resolveAccess('operator', '/api/bodega/orden/55', 'GET')).toBe('allow');
  });

  it('allows the auth endpoints — an operator must be able to log out', () => {
    expect(resolveAccess('operator', '/api/auth/logout', 'POST')).toBe('allow');
    expect(resolveAccess('operator', '/api/auth/session', 'GET')).toBe('allow');
  });

  it('forbids the same paths with the wrong method', () => {
    // Creating units and reading the movement feed are admin work.
    expect(resolveAccess('operator', '/api/inventory/assets', 'POST')).toBe('forbidden');
    expect(resolveAccess('operator', '/api/inventory/movements', 'GET')).toBe('forbidden');
  });

  it('forbids every other API — 403 JSON, never a redirect', () => {
    expect(resolveAccess('operator', '/api/orders', 'GET')).toBe('forbidden');
    expect(resolveAccess('operator', '/api/operators', 'GET')).toBe('forbidden');
    expect(resolveAccess('operator', '/api/products/9', 'PUT')).toBe('forbidden');
    expect(resolveAccess('operator', '/api/inventory/progress', 'GET')).toBe('forbidden');
    // Sub-paths of an allowed endpoint are not the endpoint.
    expect(resolveAccess('operator', '/api/inventory/assets/12', 'GET')).toBe('forbidden');
  });

  it('is case-insensitive on the method and ignores trailing slashes', () => {
    expect(resolveAccess('operator', '/api/inventory/movements/', 'post')).toBe('allow');
  });
});

describe('resolveAccess — unknown role', () => {
  it('treats a role it does not know as no access at all', () => {
    expect(resolveAccess('root', '/dashboard')).toBe('redirect');
    expect(resolveAccess('root', '/api/orders', 'GET')).toBe('forbidden');
    expect(resolveAccess('', '/bodega')).toBe('redirect');
  });
});

describe('error copy', () => {
  it('is the Spanish the API returns', () => {
    expect(INACTIVE_ACCOUNT_ERROR).toBe('Tu cuenta está desactivada');
    expect(FORBIDDEN_ROLE_ERROR).toBe('Permisos insuficientes para esta operación');
  });
});
