import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";
import { withAuth } from "../../../middleware/auth";
// CORS handled by global middleware

const jsonHeaders = { "Content-Type": "application/json" };

// Development aid only (T-12): production builds answer 404, even for a signed-in admin.
const notFound = async () =>
  new Response(JSON.stringify({ success: false, error: "No encontrado" }), {
    status: 404,
    headers: jsonHeaders,
  });

const devDiagnostic = withAuth(async () => {
  try {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not available");
    }

    const {
      data: allCoupons,
      error: allError,
      count: totalCount,
    } = await supabaseAdmin
      .from("coupons")
      .select("*", { count: "exact" })
      .order("date_created", { ascending: false });

    if (allError) throw allError;

    const statusDistribution: Record<string, number> = {};
    const now = new Date();
    let expiredCount = 0;
    let activeCount = 0;

    allCoupons?.forEach((coupon) => {
      const status = coupon.status || "null";
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;

      if (coupon.date_expires && new Date(coupon.date_expires) < now) {
        expiredCount++;
      }

      const isNotExpired =
        !coupon.date_expires || new Date(coupon.date_expires) > now;
      const hasUsagesLeft =
        coupon.usage_limit === null ||
        (coupon.usage_count || 0) < coupon.usage_limit;
      const isPublished =
        coupon.status === "publish" || coupon.status === "active";

      if (isNotExpired && hasUsagesLeft && isPublished) {
        activeCount++;
      }
    });

    const sampleCoupons = allCoupons?.slice(0, 5).map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      status: coupon.status,
      date_expires: coupon.date_expires,
      usage_count: coupon.usage_count,
      usage_limit: coupon.usage_limit,
      amount: coupon.amount,
      discount_type: coupon.discount_type,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        debug: {
          totalCoupons: totalCount || 0,
          statusDistribution,
          expiredCount,
          activeCount,
          sampleCoupons,
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error(
      "[GET /api/coupons/debug] Error en diagnóstico de cupones:",
      error,
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error en diagnóstico de cupones",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});

export const GET: APIRoute = (context) =>
  import.meta.env.DEV ? devDiagnostic(context) : notFound();
