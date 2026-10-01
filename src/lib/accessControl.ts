/**
 * Role-based access control for the dashboard — one pure function, two callers.
 *
 * WHY THIS EXISTS. Until batch 3 the dashboard had one kind of account: an admin who could open
 * everything. The garage workers who scan asset tags in and out (`/bodega`) need their own
 * accounts so `asset_movements.checked_by_admin_id` names the person who scanned, but they must
 * not see orders, clients or money. `operator` is that account; this module decides what it may
 * reach.
 *
 * WHY A PURE MODULE. `src/middleware/index.ts` imports `astro:middleware`, a virtual module vitest
 * cannot resolve, so the gating rules cannot be tested in place. They live here instead, and the
 * two enforcement points call `resolveAccess` and act on its verdict:
 *
 *   - the global middleware, for pages: `'redirect'` sends the operator to `/bodega`;
 *   - `withAuth`, for APIs: `'forbidden'` becomes a 403 JSON body.
 *
 * The allowlist is deliberately narrow and enumerated: an operator can hit the asset lookup
 * (`GET /api/inventory/assets?tag=`), record a movement (`POST /api/inventory/movements`), the
 * garage's own endpoints (`/api/bodega/*`), and the auth endpoints so they can log out. Adding a
 * capability to the garage means adding a line here — and a test.
 *
 * `resolveAccess` sees the path and the method, not the query string. For `GET
 * /api/inventory/assets` that is not enough: the same route also lists a product's units by
 * `?product_id=` and looks up by `?serial=`, which are admin views of the inventory. The route
 * itself refuses an operator without `?tag=` (403, `FORBIDDEN_ROLE_ERROR`) — the intent is that
 * an operator can resolve ONE label they are holding, never enumerate the fleet (R1-101).
 *
 * `admin_users.role` is pinned to `ADMIN_ROLES` by the CHECK constraint in migration 0011; the
 * migration test asserts the two lists agree.
 */

export const ADMIN_ROLES = ['admin', 'super_admin', 'operator'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Roles that see the whole dashboard. Operators are gated by `resolveAccess`. */
export const FULL_ACCESS_ROLES: readonly AdminRole[] = ['admin', 'super_admin'];

export const OPERATOR_HOME = '/bodega';
export const ADMIN_HOME = '/dashboard';

export const INACTIVE_ACCOUNT_ERROR = 'Tu cuenta está desactivada';
export const FORBIDDEN_ROLE_ERROR = 'Permisos insuficientes para esta operación';

export type AccessDecision = 'allow' | 'redirect' | 'forbidden';

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasFullAccess(role: string): boolean {
  return (FULL_ACCESS_ROLES as readonly string[]).includes(role);
}

/** Where a freshly authenticated session lands. */
export function homeFor(role: string): string {
  return role === 'operator' ? OPERATOR_HOME : ADMIN_HOME;
}

/**
 * The page the login form navigates to: the server's `redirect_to` wins (it knows the role), the
 * form's prop is the fallback for an older response, and `/dashboard` is the floor (R3-103).
 */
export function resolveLanding(serverRedirect: string | null | undefined, fallback: string | null | undefined): string {
  return serverRedirect?.trim() || fallback?.trim() || ADMIN_HOME;
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/** `/bodega`, `/bodega/`, `/bodega/anything` — but not `/bodegas` or `/bodega-x`. */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Astro's build output and the usual public files. The garage page needs its own islands. */
function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith('/_astro/') || pathname.startsWith('/_image') || /\.[a-z0-9]+$/i.test(pathname);
}

const OPERATOR_PAGES = [OPERATOR_HOME];
const OPERATOR_PUBLIC_PAGES = ['/', '/login', '/logout'];

/** `[method, exact path]` — the method matters: creating units and reading the feed are admin work. */
const OPERATOR_API_EXACT: ReadonlyArray<readonly [string, string]> = [
  ['GET', '/api/inventory/assets'],
  ['POST', '/api/inventory/movements'],
];

/** Any method under these prefixes. */
const OPERATOR_API_PREFIXES = ['/api/bodega', '/api/auth'];

function operatorApiAccess(pathname: string, method: string): AccessDecision {
  const verb = method.toUpperCase();
  if (OPERATOR_API_EXACT.some(([m, p]) => m === verb && p === pathname)) return 'allow';
  if (OPERATOR_API_PREFIXES.some((prefix) => isUnder(pathname, prefix))) return 'allow';
  return 'forbidden';
}

function operatorPageAccess(pathname: string): AccessDecision {
  if (OPERATOR_PUBLIC_PAGES.includes(pathname)) return 'allow';
  if (OPERATOR_PAGES.some((prefix) => isUnder(pathname, prefix))) return 'allow';
  if (isStaticAsset(pathname)) return 'allow';
  return 'redirect';
}

/**
 * The verdict for one request. `pathname` may carry a query string (it is dropped); `method`
 * defaults to GET so page checks can omit it.
 */
export function resolveAccess(role: string, pathname: string, method = 'GET'): AccessDecision {
  if (hasFullAccess(role)) return 'allow';

  const cleanPath = stripTrailingSlash(pathname.split('?')[0] ?? pathname);

  if (role !== 'operator') {
    return isApiPath(cleanPath) ? 'forbidden' : 'redirect';
  }

  return isApiPath(cleanPath) ? operatorApiAccess(cleanPath, method) : operatorPageAccess(cleanPath);
}
