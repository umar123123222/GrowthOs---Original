/**
 * Centralized logging system to replace console.log/error throughout the app
 * Provides structured logging with proper levels and production safety
 */

interface LogData {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log info messages (only in development)
   */
  info(message: string, data?: LogData): void {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, data || '');
    }
  }

  /**
   * Log warning messages (always logged)
   */
  warn(message: string, data?: LogData): void {
    console.warn(`[WARN] ${message}`, data || '');
  }

  /**
   * Log error messages (always logged)
   */
  error(message: string, error?: any, data?: LogData): void {
    console.error(`[ERROR] ${message}`, error || '', data || '');
    
    // In production, send to monitoring service
    if (!this.isDevelopment && typeof window !== 'undefined') {
      // TODO: Integrate with monitoring service (Sentry, LogRocket, etc.)
      this.sendToMonitoring('error', message, error, data);
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: LogData): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, data?: LogData): void {
    if (this.isDevelopment) {
      console.log(`[PERF] ${operation}: ${duration}ms`, data || '');
    }
    
    // In production, send performance data to analytics
    if (!this.isDevelopment) {
      this.sendPerformanceMetric(operation, duration, data);
    }
  }

  /**
   * Log user activity for analytics
   */
  activity(action: string, data?: LogData): void {
    if (this.isDevelopment) {
      console.log(`[ACTIVITY] ${action}`, data || '');
    }
    
    // Send to analytics service
    this.sendActivityMetric(action, data);
  }

  private sendToMonitoring(level: string, message: string, error?: any, data?: LogData): void {
    // TODO: Implement monitoring service integration
    // Example: Sentry.captureException(error, { extra: data, level });
  }

  private sendPerformanceMetric(operation: string, duration: number, data?: LogData): void {
    // TODO: Implement performance monitoring
    // Example: analytics.track('performance', { operation, duration, ...data });
  }

  private sendActivityMetric(action: string, data?: LogData): void {
    // TODO: Implement user activity tracking
    // Example: analytics.track(action, data);
  }
}

export const logger = new Logger();

/**
 * Performance measurement utility
 */
export const measurePerformance = <T>(
  operation: string,
  fn: () => Promise<T> | T
): Promise<T> | T => {
  const start = performance.now();
  
  if (fn.constructor.name === 'AsyncFunction' || typeof (fn as any).then === 'function') {
    return (fn() as Promise<T>).finally(() => {
      const end = performance.now();
      logger.performance(operation, end - start);
    });
  } else {
    const result = fn() as T;
    const end = performance.now();
    logger.performance(operation, end - start);
    return result;
  }
};

/**
 * Error boundary helper for React components
 */
export const logReactError = (error: Error, errorInfo: any, componentName: string): void => {
  logger.error(`React Error in ${componentName}`, error, {
    componentStack: errorInfo.componentStack,
    errorBoundary: componentName
  });
};