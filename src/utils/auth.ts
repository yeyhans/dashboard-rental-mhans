/**
 * Authentication utilities for admin session management
 */

export interface AdminUser {
  id: string
  email: string
  role: string
  created_at: string
  last_sign_in_at?: string
  email_confirmed_at?: string
}

export interface AdminSession {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  expires_in?: number
  token_type?: string
}

export interface StoredAuthData {
  user: AdminUser
  session: AdminSession
  preferences: {
    remember_me: boolean
    session_duration: number
    expires_at: string
  }
}

/**
 * Get stored admin session data
 */
export const getStoredAuthData = (): StoredAuthData | null => {
  if (typeof window === 'undefined') return null
  
  try {
    const sessionData = localStorage.getItem('admin_session')
    const userData = localStorage.getItem('admin_user')
    const rememberMe = localStorage.getItem('admin_remember_me') === 'true'
    
    if (!sessionData || !userData) return null
    
    const session: AdminSession = JSON.parse(sessionData)
    const user: AdminUser = JSON.parse(userData)
    
    // Check if session is expired
    if (session.expires_at && Date.now() / 1000 > session.expires_at) {
      clearAuthData()
      return null
    }
    
    return {
      user,
      session,
      preferences: {
        remember_me: rememberMe,
        session_duration: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        expires_at: new Date(session.expires_at ? session.expires_at * 1000 : Date.now()).toISOString()
      }
    }
  } catch (error) {
    console.error('Error parsing stored auth data:', error)
    clearAuthData()
    return null
  }
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const authData = getStoredAuthData()
  return authData !== null
}

/**
 * Get current admin user
 */
export const getCurrentUser = (): AdminUser | null => {
  const authData = getStoredAuthData()
  return authData?.user || null
}

/**
 * Get current session
 */
export const getCurrentSession = (): AdminSession | null => {
  const authData = getStoredAuthData()
  return authData?.session || null
}

/**
 * Clear all authentication data
 */
export const clearAuthData = (): void => {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem('admin_session')
  localStorage.removeItem('admin_user')
  localStorage.removeItem('admin_remember_me')
}

/**
 * Logout user and redirect to login
 */
export const logout = async (): Promise<void> => {
  try {
    // Call logout API
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getCurrentSession()?.access_token}`
      }
    })
  } catch (error) {
    console.error('Error during logout API call:', error)
  } finally {
    // Always clear local data and redirect
    clearAuthData()
    window.location.href = '/login'
  }
}

/**
 * Check if user has specific role
 */
export const hasRole = (requiredRole: string): boolean => {
  const user = getCurrentUser()
  return user?.role === requiredRole || user?.role === 'admin'
}

/**
 * Redirect to login if not authenticated
 */
export const requireAuth = (): void => {
  if (!isAuthenticated()) {
    window.location.href = '/login'
  }
}

/**
 * Get authorization header for API requests
 */
export const getAuthHeader = (): Record<string, string> => {
  const session = getCurrentSession()
  if (!session?.access_token) return {}
  
  return {
    'Authorization': `Bearer ${session.access_token}`
  }
}

/**
 * Make authenticated API request
 */
export const authenticatedFetch = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const authHeaders = getAuthHeader()
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers
    }
  })
}
