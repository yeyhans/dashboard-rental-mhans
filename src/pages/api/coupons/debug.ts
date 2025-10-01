import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async () => {
  try {
    console.log('🔍 Debug: Checking coupons table...');

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }

    // Get all coupons without any filters
    const { data: allCoupons, error: allError, count: totalCount } = await supabaseAdmin
      .from('coupons')
      .select('*', { count: 'exact' })
      .order('date_created', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching all coupons:', allError);
      throw allError;
    }

    console.log(`📊 Total coupons in database: ${totalCount}`);

    // Get status distribution
    const statusDistribution: Record<string, number> = {};
    const now = new Date();
    let expiredCount = 0;
    let activeCount = 0;

    allCoupons?.forEach(coupon => {
      // Count by status
      const status = coupon.status || 'null';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;

      // Count expired
      if (coupon.date_expires && new Date(coupon.date_expires) < now) {
        expiredCount++;
      }

      // Count truly active (not expired, has uses left)
      const isNotExpired = !coupon.date_expires || new Date(coupon.date_expires) > now;
      const hasUsagesLeft = coupon.usage_limit === null || (coupon.usage_count || 0) < coupon.usage_limit;
      const isPublished = coupon.status === 'publish' || coupon.status === 'active';
      
      if (isNotExpired && hasUsagesLeft && isPublished) {
        activeCount++;
      }
    });

    console.log('📈 Status distribution:', statusDistribution);
    console.log(`⏰ Expired coupons: ${expiredCount}`);
    console.log(`✅ Truly active coupons: ${activeCount}`);

    // Sample of first 5 coupons for inspection
    const sampleCoupons = allCoupons?.slice(0, 5).map(coupon => ({
      id: coupon.id,
      code: coupon.code,
      status: coupon.status,
      date_expires: coupon.date_expires,
      usage_count: coupon.usage_count,
      usage_limit: coupon.usage_limit,
      amount: coupon.amount,
      discount_type: coupon.discount_type
    }));

    return new Response(JSON.stringify({
      success: true,
      debug: {
        totalCoupons: totalCount || 0,
        statusDistribution,
        expiredCount,
        activeCount,
        sampleCoupons,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 Error in debug endpoint:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error en diagnóstico de cupones',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { status: 200 });
});
