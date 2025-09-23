import type { APIRoute } from 'astro';

/**
 * API endpoint to handle user logout.
 * It clears the Supabase session cookies, effectively logging the user out.
 */
export const POST: APIRoute = async ({ cookies }) => {
  // Clear the Supabase session cookies by setting their expiration date to the past.
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });

  // Return a success response. The client will handle the redirect.
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Logged out successfully' 
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
