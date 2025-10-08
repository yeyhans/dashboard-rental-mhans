import { getCurrentAccessToken, isExtendedSessionValid } from '../lib/authService';

/**
 * Cliente API profesional con manejo automático de autenticación
 * Optimizado para sesiones extendidas de administrador
 */
class ApiClient {
  private baseUrl: string;
  private tokenCache: { token: string | null; expiry: number } | null = null;
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutos

  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    console.log('🔧 ApiClient inicializado para:', this.baseUrl);
  }

  /**
   * Obtiene el token de autorización con cache optimizado
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Verificar cache primero
      if (this.tokenCache && Date.now() < this.tokenCache.expiry) {
        if (typeof window !== 'undefined') {
          console.log('🔄 Usando token desde cache');
        }
        return this.tokenCache.token;
      }

      // Si estamos en el cliente y tiene sesión extendida válida, optimizar
      if (typeof window !== 'undefined' && isExtendedSessionValid()) {
        const token = await getCurrentAccessToken();
        
        // Actualizar cache
        this.tokenCache = {
          token,
          expiry: Date.now() + this.CACHE_TTL
        };
        
        console.log('✅ Token obtenido desde sesión extendida');
        return token;
      }

      // Fallback a método estándar
      const token = await getCurrentAccessToken();
      
      // Actualizar cache
      this.tokenCache = {
        token,
        expiry: Date.now() + this.CACHE_TTL
      };
      
      return token;
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('❌ Error obteniendo token:', error);
      }
      return null;
    }
  }

  /**
   * Limpia el cache de tokens (útil después de logout)
   */
  public clearTokenCache(): void {
    this.tokenCache = null;
    console.log('🧹 Cache de tokens limpiado');
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
    } else if (typeof window !== 'undefined') {
      // Solo mostrar este mensaje en el cliente
      console.log('🔧 Making request without auth token');
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
   * Maneja respuestas JSON con manejo de errores mejorado
   */
  async handleJsonResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      
      // Manejar errores de autenticación específicamente
      if (response.status === 401) {
        const authError = errorData.error || 'Token de autorización requerido';
        
        // Limpiar cache de tokens en caso de error 401
        this.clearTokenCache();
        
        if (typeof window !== 'undefined') {
          console.error('🔒 Error de autenticación:', authError);
          
          // Si tiene sesión extendida pero aún así falla, podría ser que expiró
          if (isExtendedSessionValid()) {
            console.warn('⚠️ Sesión extendida parece válida pero servidor rechaza. Posible expiración.');
          } else {
            console.warn('⚠️ No hay sesión extendida válida. Redirigiendo a login...');
            // Opcional: redirigir automáticamente
            // window.location.href = '/';
          }
        } else {
          console.log('🔧 Error 401 en contexto servidor - endpoint puede no requerir auth');
        }
        
        throw new Error(`Autenticación requerida: ${authError}`);
      }
      
      // Manejar otros errores comunes
      if (response.status === 403) {
        throw new Error(`Permisos insuficientes: ${errorData.error || 'Acceso denegado'}`);
      }
      
      if (response.status === 404) {
        throw new Error(`Recurso no encontrado: ${errorData.error || 'Not found'}`);
      }
      
      if (response.status >= 500) {
        throw new Error(`Error del servidor: ${errorData.error || 'Internal server error'}`);
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Información del estado actual del cliente
   */
  public getClientInfo() {
    return {
      baseUrl: this.baseUrl,
      hasTokenCache: !!this.tokenCache,
      tokenCacheValid: this.tokenCache ? Date.now() < this.tokenCache.expiry : false,
      isExtendedSessionValid: typeof window !== 'undefined' ? isExtendedSessionValid() : false,
      environment: typeof window !== 'undefined' ? 'client' : 'server'
    };
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();

/**
 * Hook para usar el cliente API en componentes React con funcionalidades adicionales
 */
export const useApiClient = () => {
  return {
    ...apiClient,
    // Funciones adicionales específicas para el hook
    getClientStatus: () => apiClient.getClientInfo(),
    refreshAuth: () => apiClient.clearTokenCache(),
    
    // Helpers para manejo de errores comunes
    isAuthError: (error: Error) => error.message.includes('Autenticación requerida'),
    isPermissionError: (error: Error) => error.message.includes('Permisos insuficientes'),
    
    // Wrapper para requests con mejor manejo de errores
    safeRequest: async <T>(requestFn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> => {
      try {
        const data = await requestFn();
        return { data, error: null };
      } catch (error) {
        console.error('🔴 API Request failed:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Error desconocido' };
      }
    }
  };
};

/**
 * Función de utilidad para verificar el estado de autenticación
 */
export const checkAuthStatus = async () => {
  try {
    const response = await apiClient.get('/api/auth/me');
    return await apiClient.handleJsonResponse(response);
  } catch (error) {
    console.log('Usuario no autenticado o error de conexión');
    return null;
  }
};
