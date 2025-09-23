import type { APIRoute } from 'astro';
import { testConnection } from '../../../lib/supabase';
import { withMiddleware, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors)(async (context) => {
  try {
    const isConnected = await testConnection();
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: isConnected ? 'connected' : 'disconnected',
        api: 'running'
      },
      version: '1.0.0'
    };

    return new Response(JSON.stringify(healthStatus), {
      status: isConnected ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
