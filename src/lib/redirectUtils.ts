/**
 * Redirect and error response utilities for backend
 */

/**
 * Create an error response with proper headers
 */
export function createErrorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    status: status
  }), {
    status: status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Redirect to login page with return URL
 */
export function redirectToLogin(returnUrl?: string) {
  const loginUrl = returnUrl ? `/login?return=${encodeURIComponent(returnUrl)}` : '/login';
  return Response.redirect(loginUrl, 302);
}

/**
 * Validate user access (placeholder for future implementation)
 */
export function validateUserAccess(user: any, resource: any): boolean {
  // Basic validation - can be expanded
  return !!user && !!resource;
}

/**
 * Handle unauthorized access
 */
export function handleUnauthorized(message: string = 'Unauthorized access') {
  return createErrorResponse(message, 401);
}
