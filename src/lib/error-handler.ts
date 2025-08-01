// Centralized error handling service
import { toast } from "@/hooks/use-toast";

export type ErrorContext = 
  | 'auth'
  | 'network'
  | 'validation'
  | 'database'
  | 'upload'
  | 'payment'
  | 'general';

export interface UserError {
  message: string;
  action?: string;
  context: ErrorContext;
}

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<string, UserError> = {
  // Authentication errors
  'invalid_credentials': {
    message: 'Your email or password is incorrect.',
    action: 'Please check your credentials and try again.',
    context: 'auth'
  },
  'email_not_verified': {
    message: 'Please verify your email address.',
    action: 'Check your inbox for a verification link.',
    context: 'auth'
  },
  'session_expired': {
    message: 'Your session has expired.',
    action: 'Please sign in again.',
    context: 'auth'
  },
  'access_denied': {
    message: 'You don\'t have permission to access this resource.',
    action: 'Contact your administrator if you need access.',
    context: 'auth'
  },

  // Network errors
  'network_error': {
    message: 'Unable to connect to our servers.',
    action: 'Please check your internet connection and try again.',
    context: 'network'
  },
  'timeout': {
    message: 'The request took too long to complete.',
    action: 'Please try again in a moment.',
    context: 'network'
  },
  'server_error': {
    message: 'Our servers are experiencing issues.',
    action: 'Please try again in a few minutes.',
    context: 'network'
  },

  // Validation errors
  'required_field': {
    message: 'This field is required.',
    action: 'Please fill in all required fields.',
    context: 'validation'
  },
  'invalid_email': {
    message: 'Please enter a valid email address.',
    context: 'validation'
  },
  'password_weak': {
    message: 'Your password must be at least 8 characters long.',
    action: 'Include uppercase, lowercase, numbers, and special characters.',
    context: 'validation'
  },
  'file_too_large': {
    message: 'The file is too large.',
    action: 'Please choose a file smaller than 10MB.',
    context: 'upload'
  },

  // Database errors
  'record_not_found': {
    message: 'The requested item could not be found.',
    action: 'It may have been deleted or moved.',
    context: 'database'
  },
  'duplicate_entry': {
    message: 'This record already exists.',
    action: 'Please use different information.',
    context: 'database'
  },
  'database_error': {
    message: 'Unable to save your changes.',
    action: 'Please try again or contact support.',
    context: 'database'
  },

  // Payment errors
  'payment_failed': {
    message: 'Your payment could not be processed.',
    action: 'Please check your payment details and try again.',
    context: 'payment'
  },
  'insufficient_funds': {
    message: 'Insufficient funds for this transaction.',
    action: 'Please use a different payment method.',
    context: 'payment'
  },

  // General fallback
  'unknown_error': {
    message: 'Something went wrong.',
    action: 'Please try again or contact support if the problem persists.',
    context: 'general'
  }
};

class ErrorHandler {
  private logError(error: any, context?: string): void {
    // Log full error details for debugging (never shown to user)
    console.error('Error Details:', {
      error,
      context,
      timestamp: new Date().toISOString(),
      stack: error?.stack,
      message: error?.message,
      code: error?.code
    });
  }

  private identifyErrorType(error: any): string {
    // Network errors
    if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
      return 'network_error';
    }
    if (error?.name === 'TimeoutError' || error?.code === 'TIMEOUT') {
      return 'timeout';
    }
    if (error?.status >= 500) {
      return 'server_error';
    }

    // Authentication errors
    if (error?.code === 'invalid_credentials' || error?.status === 401) {
      return 'invalid_credentials';
    }
    if (error?.code === 'email_not_verified') {
      return 'email_not_verified';
    }
    if (error?.status === 403) {
      return 'access_denied';
    }

    // Database errors
    if (error?.code === '23505' || error?.message?.includes('duplicate')) {
      return 'duplicate_entry';
    }
    if (error?.status === 404) {
      return 'record_not_found';
    }
    if (error?.code?.startsWith('PGRST') || error?.hint) {
      return 'database_error';
    }

    // Validation errors
    if (error?.code === 'invalid_email') {
      return 'invalid_email';
    }
    if (error?.code === 'weak_password') {
      return 'password_weak';
    }

    // Payment errors
    if (error?.type === 'card_error') {
      return 'payment_failed';
    }

    return 'unknown_error';
  }

  private getUserMessage(errorType: string): UserError {
    return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.unknown_error;
  }

  public handleError(error: any, context?: string, showToast = true): UserError {
    // Log technical details
    this.logError(error, context);

    // Get user-friendly message
    const errorType = this.identifyErrorType(error);
    const userError = this.getUserMessage(errorType);

    // Show toast notification if requested
    if (showToast) {
      this.showErrorToast(userError);
    }

    return userError;
  }

  public showErrorToast(userError: UserError): void {
    const description = userError.action 
      ? `${userError.message} ${userError.action}`
      : userError.message;

    toast({
      title: "Error",
      description,
      variant: "destructive",
    });
  }

  public handleAsyncError(promise: Promise<any>, context?: string): Promise<any> {
    return promise.catch((error) => {
      this.handleError(error, context);
      throw error; // Re-throw for component handling
    });
  }

  public createFieldError(message: string): UserError {
    return {
      message,
      context: 'validation'
    };
  }
}

// Global error handler for uncaught errors
export const setupGlobalErrorHandling = () => {
  window.addEventListener('error', (event) => {
    errorHandler.handleError(event.error, 'global_error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handleError(event.reason, 'unhandled_promise');
    event.preventDefault();
  });
};

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Utility functions for common error scenarios
export const handleApiError = (error: any, context = 'api') => {
  return errorHandler.handleError(error, context, false);
};

export const handleFormError = (error: any, setError?: (field: string, error: any) => void) => {
  const userError = errorHandler.handleError(error, 'form', false);
  
  if (setError && error?.field) {
    setError(error.field, { message: userError.message });
  }
  
  return userError;
};

export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return ((...args: any[]) => {
    return errorHandler.handleAsyncError(fn(...args), context);
  }) as T;
};