import type { APIRoute } from 'astro';
import { BackendApiService } from '../../../services/backendApiService';
import { withMiddleware, withCors, withAuth } from '../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const result = await BackendApiService.getEligibleUsers(page, limit);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching eligible users:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
