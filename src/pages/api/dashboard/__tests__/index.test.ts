import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserStats = vi.fn();
const getOrderStats = vi.fn();
const getProductStats = vi.fn();
const getCouponStats = vi.fn();

/**
 * Supabase is mocked at its own boundary — `createClient` — so `withAuth`, `getServerAdmin` and
 * `getServerUser` all run for real. An earlier version of this suite stubbed `withAuth` itself
 * with a `context.locals.user` check that exists nowhere in the codebase: it would have passed
 * unchanged even if the real gate had been deleted.
 */
const authGetUser = vi.fn();
const refreshSession = vi.fn();
const adminFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: authGetUser, refreshSession },
    from: adminFrom,
  }),
}));

vi.mock('../../../../services/userService', () => ({ UserService: { getUserStats } }));
vi.mock('../../../../services/orderService', () => ({ OrderService: { getOrderStats } }));
vi.mock('../../../../services/productService', () => ({ ProductService: { getProductStats } }));
vi.mock('../../../../services/couponService', () => ({ CouponService: { getCouponStats } }));

function stubStats() {
  getUserStats.mockResolvedValue({ totalUsers: 10, usersWithContracts: 4, recentUsers: 2 });
  getOrderStats.mockResolvedValue({
    totalOrders: 20,
    totalRevenue: '1000',
    averageOrderValue: '50',
    monthlyOrders: 4,
    pendingOrders: 1,
    processingOrders: 1,
    completedOrders: 17,
    cancelledOrders: 1,
    statusCounts: {},
  });
  getProductStats.mockResolvedValue({
    totalProducts: 5,
    activeProducts: 4,
    inactiveProducts: 1,
    outOfStock: 0,
    featuredProducts: 2,
  });
  getCouponStats.mockResolvedValue({
    totalCoupons: 3,
    activeCoupons: 2,
    usedCoupons: 1,
    expiredCoupons: 0,
    totalDiscount: '0',
    usageRate: '0%',
  });
}

/** `admin_users` lookup: .from().select().eq().in().single() */
function stubAdminLookup(result: { data: unknown; error: unknown }) {
  adminFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        in: () => ({ single: () => Promise.resolve(result) }),
      }),
    }),
  });
}

/** The handler takes no context param; auth is decided entirely from the request cookies. */
function requestWithCookie(cookie?: string) {
  const headers = cookie ? { cookie } : undefined;
  return {
    request: new Request('https://dashboard.mariohans.cl/api/dashboard', {
      method: 'GET',
      ...(headers ? { headers } : {}),
    }),
    url: new URL('https://dashboard.mariohans.cl/api/dashboard'),
  };
}

describe('dashboard aggregate stats authorization (F5)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    refreshSession.mockResolvedValue({ data: {}, error: { message: 'Invalid Refresh Token' } });
    stubStats();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects a request with no session cookie without touching any aggregate service', async () => {
    const { GET } = await import('../index');

    const response = await GET(requestWithCookie() as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.data).toBeUndefined();
    expect(authGetUser).not.toHaveBeenCalled();
    expect(getOrderStats).not.toHaveBeenCalled();
    expect(getUserStats).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired session cookie that cannot be refreshed', async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    const { GET } = await import('../index');

    const response = await GET(requestWithCookie('sb-access-token=expired-jwt') as never);

    expect(response.status).toBe(401);
    expect(authGetUser).toHaveBeenCalledWith('expired-jwt');
    expect(getOrderStats).not.toHaveBeenCalled();
  });

  it('rejects a valid session whose user is not in admin_users', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'cliente@x.cl' } }, error: null });
    // PGRST116 = no row matched, i.e. the session is real but carries no admin role.
    stubAdminLookup({ data: null, error: { code: 'PGRST116' } });
    const { GET } = await import('../index');

    const response = await GET(requestWithCookie('sb-access-token=valid-jwt') as never);

    expect(response.status).toBe(401);
    expect(getOrderStats).not.toHaveBeenCalled();
  });

  it('returns aggregate data for a valid admin session', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@x.cl' } }, error: null });
    stubAdminLookup({ data: { id: 1, user_id: 'admin-1', email: 'admin@x.cl', role: 'admin' }, error: null });
    const { GET } = await import('../index');

    const response = await GET(requestWithCookie('sb-access-token=valid-jwt') as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.overview.totalRevenue).toBe('1000');
  });

  it('serves super_admin sessions, not just role admin', async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: 'admin-2', email: 'boss@x.cl' } }, error: null });
    stubAdminLookup({ data: { id: 2, user_id: 'admin-2', email: 'boss@x.cl', role: 'super_admin' }, error: null });
    const { GET } = await import('../index');

    const response = await GET(requestWithCookie('sb-access-token=valid-jwt') as never);

    expect(response.status).toBe(200);
  });
});
