type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  userId?: string;
  requestId?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV || false;

  private formatMessage(level: LogLevel, message: string, context?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  private log(entry: LogEntry): void {
    const logString = JSON.stringify(entry, null, this.isDevelopment ? 2 : 0);
    
    switch (entry.level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(logString);
        }
        break;
      default:
        console.log(logString);
    }
  }

  info(message: string, context?: any): void {
    this.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: any): void {
    this.log(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | any, context?: any): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    this.log(this.formatMessage('error', message, errorContext));
  }

  debug(message: string, context?: any): void {
    this.log(this.formatMessage('debug', message, context));
  }

  // Método para logging de requests HTTP
  request(method: string, url: string, userId?: string, requestId?: string): void {
    const entry = this.formatMessage('info', `${method} ${url}`, {
      type: 'http_request',
      method,
      url,
    });
    entry.userId = userId;
    entry.requestId = requestId;
    this.log(entry);
  }

  // Método para logging de respuestas HTTP
  response(method: string, url: string, status: number, duration: number, userId?: string, requestId?: string): void {
    const entry = this.formatMessage('info', `${method} ${url} - ${status} (${duration}ms)`, {
      type: 'http_response',
      method,
      url,
      status,
      duration,
    });
    entry.userId = userId;
    entry.requestId = requestId;
    this.log(entry);
  }

  // Método para logging de operaciones de base de datos
  database(operation: string, table: string, success: boolean, duration?: number, context?: any): void {
    this.log(this.formatMessage(success ? 'info' : 'error', `DB ${operation} on ${table}`, {
      type: 'database_operation',
      operation,
      table,
      success,
      duration,
      ...context,
    }));
  }

  // Método para logging de autenticación
  auth(event: string, userId?: string, success: boolean = true, context?: any): void {
    this.log(this.formatMessage(success ? 'info' : 'warn', `Auth: ${event}`, {
      type: 'authentication',
      event,
      userId,
      success,
      ...context,
    }));
  }
}

export const logger = new Logger();
