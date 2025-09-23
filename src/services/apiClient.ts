import { supabase } from '../lib/supabase';

/**
 * Cliente API que maneja automáticamente la autenticación
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  /**
   * Obtiene el token de autorización actual
   */
  private async getAuthToken(): Promise<string | null> {
    if (!supabase) {
      console.warn('Supabase client not available');
      return null;
    }
    
    try {
      console.log('Getting auth session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      
      if (!session) {
        console.warn('No active session found');
        return null;
      }
      
      console.log('Session found:', { 
        user: session.user?.email, 
        hasToken: !!session.access_token 
      });
      
      return session.access_token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Realiza una petición HTTP con autenticación automática
   */
  private async request(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Agregar token de autorización si está disponible
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * GET request
   */
  async get(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post(endpoint: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
    });
  }

  /**
   * PUT request
   */
  async put(endpoint: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Maneja respuestas JSON con manejo de errores
   */
  async handleJsonResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      
      // Manejar errores de autenticación específicamente
      if (response.status === 401) {
        const authError = errorData.error || 'Token de autorización requerido';
        console.error('Authentication error:', authError);
        
        // Opcional: redirigir al login o mostrar modal de autenticación
        if (typeof window !== 'undefined') {
          console.warn('Usuario no autenticado. Considere redirigir al login.');
        }
        
        throw new Error(`Autenticación requerida: ${authError}`);
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();

/**
 * Hook para usar el cliente API en componentes React
 */
export const useApiClient = () => {
  return apiClient;
};
