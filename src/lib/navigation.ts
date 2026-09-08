/**
 * The Área 01 sidebar, as data.
 *
 * Source: `CONSOLIDADO WEB YEYSON/Área 01 · Rental Técnico/OFF/*.html`. The `<aside class="side">`
 * block is byte-identical across all eight canonical documents, which is what makes it the shell
 * rather than one module's decoration: three labelled groups, eight modules, `--sidebar-w: 232px`.
 *
 * Kept as data so the order, the labels and the active-route resolution are testable — this
 * project has no jsdom, so a JSX-only sidebar would go unverified, and a module that never marks
 * itself active looks exactly like a dead link.
 */

import { hasFullAccess, type AdminRole } from './accessControl';

/** Lucide icon name. Resolved by the shell; kept as a string so this module stays renderer-free. */
export interface NavModule {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  /** Badge count slot, e.g. open alerts. Resolved at render time, never hard-coded here. */
  readonly badgeKey?: 'alerts';
  /**
   * Roles that see this entry. Omitted = every full-access role. This only hides the link; the
   * route itself is guarded server-side (`accessControl.ts`, the page's own role check).
   */
  readonly roles?: readonly AdminRole[];
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavModule[];
}

/**
 * Route decisions, recorded because the canonical links to sibling HTML files and says nothing
 * about this app's URLs:
 *
 *  · Centro de Control → `/dashboard`, the existing landing page. Renaming the route would break
 *    every bookmark an admin has for no gain; the canonical constrains the LABEL, not the path.
 *  · Catálogo Equipos → `/products` and Clientes & Documentos → `/users`, the existing modules
 *    under their canonical names. The nouns changed, the data did not.
 *  · Check-In / Devoluciones, Delivery, Finanzas & Cobranza and Rentabilidad are new routes.
 *  · Alertas is `/dashboard/alerts` rather than the canonical's `#alertas` anchor: an anchor
 *    cannot carry `aria-current="page"` nor be linked from an email.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Torre de Control',
    items: [
      { label: 'Centro de Control', href: '/dashboard', icon: 'Tower' },
      { label: 'Alertas', href: '/dashboard/alerts', icon: 'Bell', badgeKey: 'alerts' },
    ],
  },
  {
    label: 'Operaciones Rental',
    items: [
      { label: 'Pedidos', href: '/orders', icon: 'Paperclip' },
      { label: 'Check-In / Devoluciones', href: '/check-in', icon: 'CircleCheck' },
      { label: 'Delivery', href: '/delivery', icon: 'Truck' },
      { label: 'Catálogo Equipos', href: '/products', icon: 'Package' },
      { label: 'Clientes & Documentos', href: '/users', icon: 'Users' },
    ],
  },
  {
    label: 'Gestión del Negocio',
    items: [
      { label: 'Finanzas & Cobranza', href: '/finance', icon: 'Coins' },
      { label: 'Rentabilidad', href: '/profitability', icon: 'TrendingUp' },
      // Not in the canonical: operator accounts arrived with batch 3 (0011). Minting logins is
      // the one thing a plain admin must not do, so only super_admin sees the entry.
      { label: 'Operarios', href: '/operators', icon: 'UserCog', roles: ['super_admin'] },
    ],
  },
];

/** Flat view of every module, in sidebar order. */
export const NAV_MODULES: readonly NavModule[] = NAV_GROUPS.flatMap(group => group.items);

/**
 * The groups one role gets to see. Operators get nothing — their shell (`/bodega`) has no
 * sidebar. A group whose every item is hidden disappears with them: an empty heading reads as
 * a broken menu.
 */
export function visibleNavGroups(role: string | null | undefined): readonly NavGroup[] {
  if (!role || !hasFullAccess(role)) return [];
  return NAV_GROUPS
    .map(group => ({
      label: group.label,
      items: group.items.filter(item => !item.roles || (item.roles as readonly string[]).includes(role)),
    }))
    .filter(group => group.items.length > 0);
}

/** Exact-path lookup. Returns `null` for a subroute — see `activeModule` for that. */
export function moduleByPath(pathname: string): NavModule | null {
  return NAV_MODULES.find(m => m.href === pathname) ?? null;
}

/**
 * The module a pathname belongs to, following subroutes.
 *
 * Matches on a `/` boundary rather than a raw prefix: `'/orders-archive'.startsWith('/orders')`
 * is true, and a naive prefix test would light up Pedidos on an unrelated page. The longest
 * match wins so a future nested module beats its parent.
 */
export function activeModule(pathname: string): NavModule | null {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  let best: NavModule | null = null;
  for (const module of NAV_MODULES) {
    const isMatch = clean === module.href || clean.startsWith(`${module.href}/`);
    if (isMatch && (!best || module.href.length > best.href.length)) best = module;
  }
  return best;
}
