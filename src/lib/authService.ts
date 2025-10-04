/**
 * Service for handling authentication in the backend admin panel
 */

let currentSessionToken: string | null = null;

/**
 * Set the current session token
 */
export const setSessionToken = (token: string) => {
  currentSessionToken = token;
  console.log('🔑 Session token updated');
};

/**
 * Get the current session token
 */
export const getSessionToken = (): string | null => {
  return currentSessionToken;
};

/**
 * Get fresh session token from Supabase
 */
export const getFreshSessionToken = async (): Promise<string | null> => {
  try {
    // Try to get fresh token from Supabase client
    if (typeof window !== 'undefined') {
      // We're in the browser, try to get token from localStorage or make a call to refresh
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session?.access_token) {
          setSessionToken(data.session.access_token);
          return data.session.access_token;
        }
      }
    }
    
    return currentSessionToken;
  } catch (error) {
    console.error('Error getting fresh session token:', error);
    return currentSessionToken;
  }
};

/**
 * Make authenticated API call with automatic token refresh
 */
export const makeAuthenticatedRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  let token = getSessionToken();
  
  // If no token, try to get a fresh one
  if (!token) {
    token = await getFreshSessionToken();
  }
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Make the request
  let response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If unauthorized, try to refresh token and retry once
  if (response.status === 401 && token) {
    console.log('🔄 Token expired, trying to refresh...');
    const freshToken = await getFreshSessionToken();
    
    if (freshToken && freshToken !== token) {
      const retryHeaders: Record<string, string> = {
        ...headers,
        'Authorization': `Bearer ${freshToken}`
      };
      response = await fetch(url, {
        ...options,
        headers: retryHeaders,
      });
    }
  }
  
  return response;
};
