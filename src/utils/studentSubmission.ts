import { supabase } from '@/integrations/supabase/client';
import { StudentFormData } from '@/hooks/useStudentFormValidation';

export interface StudentSubmissionPayload {
  full_name: string;
  email: string;
  phone: string;
  installments: number;
  company_id?: string;
  course_id?: string;
}

export interface StudentSubmissionResult {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
}

export class StudentSubmissionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'StudentSubmissionError';
  }
}

const SUBMISSION_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 1;

export const submitStudentForm = async (
  formData: StudentFormData,
  retryCount = 0
): Promise<StudentSubmissionResult> => {
  console.log('Starting student submission:', { formData, retryCount });
  
  try {
    // Extract installment count from fees_structure (e.g., "3_installments" -> 3)
    const installmentMatch = formData.fees_structure.match(/^(\d+)_installments?$/);
    const installments = installmentMatch ? parseInt(installmentMatch[1]) : 1;

    // Create snake-cased payload
    const payload: StudentSubmissionPayload = {
      full_name: formData.full_name.trim(),
      email: formData.email.toLowerCase().trim(),
      phone: formData.phone.trim(),
      installments,
      // TODO: Add company_id and course_id when available
      // company_id: "default-company-id",
      // course_id: "default-course-id"
    };

    console.log('Submitting student form with payload:', payload);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBMISSION_TIMEOUT);

    try {
      const { data, error } = await supabase.functions.invoke('create-student-complete', {
        body: payload,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('Edge function error:', error);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        throw new StudentSubmissionError(
          mapErrorMessage(error),
          getErrorCode(error),
          error
        );
      }

      if (!data?.success) {
        throw new StudentSubmissionError(
          data?.error || 'Failed to create student',
          'FUNCTION_ERROR',
          data
        );
      }

      console.log('Student creation successful:', data);

      return {
        success: true,
        data
      };

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
      console.error('Full fetch error object:', JSON.stringify(fetchError, null, 2));
      
      // Handle AbortError (timeout)
      if (fetchError.name === 'AbortError') {
        console.log('Request timed out');
        throw new StudentSubmissionError(
          'Network problem—please try again.',
          'TIMEOUT'
        );
      }

      // Handle network errors
      if (fetchError.message?.includes('NetworkError') || fetchError.message?.includes('fetch')) {
        console.log('Network error detected');
        throw new StudentSubmissionError(
          'Network problem—please try again.',
          'NETWORK_ERROR'
        );
      }

      throw fetchError;
    }

  } catch (error) {
    console.error('Student submission error:', error);
    console.error('Full submission error object:', JSON.stringify(error, null, 2));

    // If this is our first attempt and we have retries left
    if (retryCount < MAX_RETRIES && shouldRetry(error)) {
      console.log(`Retrying submission (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      return submitStudentForm(formData, retryCount + 1);
    }

    // Handle specific error types
    if (error instanceof StudentSubmissionError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }

    // Handle unknown errors
    const errorMessage = getUnknownErrorMessage(error);
    
    // Log to Sentry for 5xx errors
    if (is5xxError(error)) {
      console.error('Server error - should be logged to Sentry:', error);
      console.error('Full 5xx error object:', JSON.stringify(error, null, 2));
      // TODO: Add Sentry logging here
      // Sentry.captureException(error);
    }

    return {
      success: false,
      error: errorMessage,
      errorCode: 'UNKNOWN_ERROR'
    };
  }
};

const mapErrorMessage = (error: any): string => {
  const errorMessage = error.message || error.toString();
  console.log('Mapping error message for:', errorMessage);
  
  // Check for PostgreSQL unique violation (duplicate email/phone)
  if (errorMessage.includes('23505')) {
    if (errorMessage.includes('students_email_key') || errorMessage.includes('users_email_key')) {
      return 'A student with this email already exists';
    }
    if (errorMessage.includes('students_phone_key') || errorMessage.includes('users_phone_key')) {
      return 'A student with this phone number already exists';
    }
    // Generic duplicate key error
    return 'This student information already exists in the system';
  }

  // Check for check constraint violation (installments exceed maximum)
  if (errorMessage.includes('users_fees_structure_check')) {
    return 'Installments exceed maximum allowed';
  }

  // Check for other constraint violations
  if (errorMessage.includes('23514')) {
    return 'Invalid data provided. Please check all fields.';
  }

  // Return error message from edge function if it's a 400 error
  if (error.status === 400 || errorMessage.includes('400')) {
    return errorMessage;
  }

  // Network errors
  if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
    return 'Network problem—please try again.';
  }

  // Server errors
  if (error.status >= 500 || errorMessage.includes('500')) {
    return 'Server error—our team has been notified';
  }

  return errorMessage;
};

const getErrorCode = (error: any): string => {
  if (error.message?.includes('23505')) {
    if (error.message.includes('email')) return 'DUPLICATE_EMAIL';
    if (error.message.includes('phone')) return 'DUPLICATE_PHONE';
    return 'DUPLICATE_KEY';
  }
  if (error.message?.includes('23514')) return 'CONSTRAINT_VIOLATION';
  if (error.status === 400) return 'BAD_REQUEST';
  if (error.status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
};

const shouldRetry = (error: any): boolean => {
  // Retry on network errors and 5xx server errors
  if (error instanceof StudentSubmissionError) {
    return error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR' || error.code === 'TIMEOUT';
  }
  
  return false;
};

const is5xxError = (error: any): boolean => {
  return error.status >= 500 || error.message?.includes('500');
};

const getUnknownErrorMessage = (error: any): string => {
  if (is5xxError(error)) {
    return 'Server error—our team has been notified';
  }
  
  return 'An unexpected error occurred. Please try again.';
};