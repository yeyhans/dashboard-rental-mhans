import { logger } from './logger';

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

/**
 * Maneja errores y los convierte en respuestas HTTP apropiadas
 */
export const handleError = (error: any, context?: { userId?: string; requestId?: string }): Response => {
  let apiError: ApiError;

  if (error instanceof AppError) {
    apiError = {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };

    // Log según el nivel de severidad
    if (error.statusCode >= 500) {
      logger.error(`Server Error: ${error.message}`, error, context);
    } else {
      logger.warn(`Client Error: ${error.message}`, { error: error.message, code: error.code }, context);
    }
  } else if (error?.code === 'PGRST116') {
    // Error específico de Supabase: No rows found
    apiError = {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
    };
    logger.warn('Resource not found', { supabaseError: error }, context);
  } else if (error?.code?.startsWith('23')) {
    // Errores de base de datos PostgreSQL
    if (error.code === '23505') {
      apiError = {
        code: 'DUPLICATE_ENTRY',
        message: 'Resource already exists',
        statusCode: 409,
      };
    } else if (error.code === '23503') {
      apiError = {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced resource does not exist',
        statusCode: 400,
      };
    } else {
      apiError = {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        statusCode: 500,
      };
    }
    logger.error('Database Error', error, context);
  } else {
    // Error genérico
    apiError = {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: 500,
    };
    logger.error('Unexpected Error', error, context);
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: apiError.message,
      code: apiError.code,
      ...(apiError.details && { details: apiError.details }),
    }),
    {
      status: apiError.statusCode,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

/**
 * Wrapper para manejar errores en endpoints de API
 */
export const withErrorHandler = (handler: (context: any) => Promise<Response>) => {
  return async (context: any) => {
    try {
      return await handler(context);
    } catch (error) {
      return handleError(error, {
        userId: context.user?.id,
        requestId: context.requestId,
      });
    }
  };
};
