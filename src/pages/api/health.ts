import type { APIRoute } from 'astro';

/**
 * Health Check Endpoint for External Frontend Services
 * Used by frontend applications to verify backend availability before making PDF generation requests
 */
export const GET: APIRoute = async () => {
  try {
    // Basic health check - verify we can respond
    const startTime = Date.now();
    
    // Check if we can connect to Supabase (optional but recommended)
    let supabaseStatus = 'unknown';
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL!,
        import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Simple query to test connection
      const { error } = await supabase.from('orders').select('id').limit(1);
      supabaseStatus = error ? 'error' : 'healthy';
    } catch (supabaseError) {
      supabaseStatus = 'error';
      console.warn('Health check: Supabase connection issue:', supabaseError);
    }

    // Check if we can access Cloudflare Worker (optional)
    let cloudflareStatus = 'unknown';
    try {
      const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;
      if (workerUrl) {
        const response = await fetch(`${workerUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        cloudflareStatus = response.ok ? 'healthy' : 'error';
      } else {
        cloudflareStatus = 'not_configured';
      }
    } catch (cloudflareError) {
      cloudflareStatus = 'error';
    }

    const responseTime = Date.now() - startTime;
    
    // Determine overall health status
    const isHealthy = supabaseStatus === 'healthy';
    const statusCode = isHealthy ? 200 : 503;
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 'unknown',
      responseTime: `${responseTime}ms`,
      version: '1.0.0',
      services: {
        database: supabaseStatus,
        storage: cloudflareStatus,
        pdf_generation: 'healthy' // Assume healthy if we can respond
      },
      environment: import.meta.env.MODE || 'production',
      endpoints: {
        budget_pdf: '/api/external/generate-budget-pdf',
        health: '/api/health'
      }
    };

    console.log(`🏥 Health check completed: ${healthData.status} (${responseTime}ms)`);

    return new Response(JSON.stringify(healthData), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('💥 Health check error:', error);
    
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown health check error',
      services: {
        database: 'error',
        storage: 'error', 
        pdf_generation: 'error'
      }
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
};

// Handle preflight OPTIONS requests for CORS
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
};
