import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ResetPasswordData } from '../../types/auth.types';
import { resetPasswordSchema } from '../../validations/auth.schema';
import useForm from '../../hooks/useForm';
import ErrorBoundary from '../common/ErrorBoundary';
import { useA11y } from '@react-aria/focus'; // v3.0.0
import { useRateLimit } from '@react-hooks/rate-limit'; // v2.0.0
import { useSecurity } from '@auth/security'; // v1.0.0

/**
 * Types of security violations that can occur during password reset
 */
export enum SecurityViolationType {
  CSRF_FAILURE = 'csrf_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  INVALID_PAYLOAD = 'invalid_payload',
  TOKEN_TAMPERING = 'token_tampering'
}

/**
 * Types of errors that can occur during password reset
 */
export enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  SERVER_ERROR = 'server_error',
  USER_NOT_FOUND = 'user_not_found',
  RATE_LIMITED = 'rate_limited',
  SECURITY_VIOLATION = 'security_violation',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Props interface for ResetPasswordForm component with enhanced callbacks
 */
interface ResetPasswordFormProps {
  /**
   * Callback triggered on successful password reset request
   * @param message Success message from the server
   */
  onSuccess: (message: string) => void;
  
  /**
   * Callback triggered when an error occurs during password reset
   * @param error Error type and details
   */
  onError: (error: ErrorType) => void;
  
  /**
   * Callback triggered when rate limit is exceeded
   * @param attempts Number of attempts made
   */
  onRateLimit: (attempts: number) => void;
  
  /**
   * Callback triggered when a security violation is detected
   * @param violation Type of security violation
   */
  onSecurityViolation: (violation: SecurityViolationType) => void;
}

/**
 * Secure and accessible password reset form component
 * 
 * This component provides a user-friendly interface for initiating password reset
 * with comprehensive security measures and accessibility features.
 */
const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  onSuccess,
  onError,
  onRateLimit,
  onSecurityViolation
}) => {
  // References for accessibility and focus management
  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  
  // Status state for form submission
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Security configuration
  const securityConfig = {
    maxAttempts: 5,
    timeWindow: 60, // seconds
    csrfToken: document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
    signRequest: true
  };
  
  // Accessibility configuration
  const a11yConfig = {
    ariaLabels: {
      form: 'Reset password form',
      emailInput: 'Enter your email address to reset your password',
      submitButton: 'Request password reset link',
      successMessage: 'Password reset email sent',
      errorMessage: 'Error requesting password reset'
    },
    autoFocus: true,
    liveRegionBehavior: 'assertive' as const
  };
  
  // Initialize form with security and validation
  const form = useForm({
    fields: [
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        validationRules: [
          {
            type: 'required',
            value: true,
            message: 'Email is required'
          },
          {
            type: 'pattern',
            value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            message: 'Please enter a valid email address'
          }
        ],
        aria: {
          label: a11yConfig.ariaLabels.emailInput
        }
      }
    ],
    initialValues: { email: '' },
    validationSchema: resetPasswordSchema,
    onSubmit: async (values) => {
      await handleSubmit(values as ResetPasswordData);
    }
  });
  
  // Rate limiting hook
  const [limitReached, attemptFunc] = useRateLimit(securityConfig.maxAttempts, securityConfig.timeWindow * 1000);
  
  // Initialize security utilities
  const { 
    validateCSRFToken, 
    signPayload, 
    detectSuspiciousPatterns 
  } = useSecurity({
    csrfToken: securityConfig.csrfToken,
    signatureKey: 'reset-password-form'
  });
  
  // Setup focus management for accessibility
  const { focusWithin } = useA11y();
  
  /**
   * Secure form submission handler with rate limiting and error handling
   * 
   * Processes the password reset request with comprehensive security checks,
   * input sanitization, and proper error handling with appropriate user feedback.
   * 
   * @param values - Form values containing the user's email
   */
  const handleSubmit = useCallback(async (values: ResetPasswordData) => {
    // Prevent submission if already submitting
    if (status === 'submitting') return;
    
    // Check rate limiting status
    if (attemptFunc() || limitReached) {
      setStatus('error');
      setStatusMessage(`Too many attempts. Please try again after ${securityConfig.timeWindow} seconds.`);
      onRateLimit(form.security.submissionAttempts);
      onError(ErrorType.RATE_LIMITED);
      return;
    }
    
    // Validate CSRF token
    const csrfValid = validateCSRFToken();
    if (!csrfValid) {
      setStatus('error');
      setStatusMessage('Security validation failed. Please refresh the page and try again.');
      onSecurityViolation(SecurityViolationType.CSRF_FAILURE);
      onError(ErrorType.SECURITY_VIOLATION);
      return;
    }
    
    // Update UI state
    setStatus('submitting');
    setStatusMessage('Processing your request...');
    
    try {
      // Sanitize input values
      const sanitizedValues = {
        email: values.email.trim().toLowerCase()
      };
      
      // Validate against security patterns
      const suspiciousPatterns = detectSuspiciousPatterns(sanitizedValues);
      if (suspiciousPatterns.length > 0) {
        setStatus('error');
        setStatusMessage('Invalid input detected. Please check your email and try again.');
        onSecurityViolation(SecurityViolationType.SUSPICIOUS_PATTERN);
        onError(ErrorType.VALIDATION_ERROR);
        return;
      }
      
      // Sign request payload for security
      let payload = sanitizedValues;
      if (securityConfig.signRequest) {
        payload = signPayload(sanitizedValues);
      }
      
      // Attempt password reset with retry logic
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': securityConfig.csrfToken,
          'X-Request-Signature': payload.signature || ''
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send password reset email');
      }
      
      const data = await response.json();
      
      // Handle specific success response
      setStatus('success');
      setStatusMessage(data.message || 'Password reset email sent. Please check your inbox.');
      onSuccess(data.message || 'Password reset email sent. Please check your inbox.');
      
      // Reset form after successful submission
      form.resetForm();
      
    } catch (error) {
      // Handle specific error types
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred. Please try again.';
      
      setStatus('error');
      setStatusMessage(errorMessage);
      
      // Determine error type for callback
      let errorType = ErrorType.UNKNOWN_ERROR;
      if (errorMessage.includes('not found')) {
        errorType = ErrorType.USER_NOT_FOUND;
      } else if (errorMessage.includes('network')) {
        errorType = ErrorType.NETWORK_ERROR;
      } else if (errorMessage.includes('server')) {
        errorType = ErrorType.SERVER_ERROR;
      }
      
      onError(errorType);
      
      // Log security events
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Password reset error:', { errorType, email: values.email });
      }
    }
  }, [
    status, 
    limitReached, 
    attemptFunc, 
    validateCSRFToken, 
    detectSuspiciousPatterns, 
    signPayload, 
    onSuccess, 
    onError, 
    onRateLimit, 
    onSecurityViolation, 
    form,
    securityConfig
  ]);
  
  // Focus the form on mount for accessibility
  useEffect(() => {
    if (a11yConfig.autoFocus && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [a11yConfig.autoFocus]);
  
  // Update ARIA live regions for screen readers
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const liveRegion = document.getElementById('reset-password-status');
      if (liveRegion) {
        liveRegion.setAttribute('aria-live', a11yConfig.liveRegionBehavior);
        liveRegion.textContent = statusMessage;
      }
    }
  }, [status, statusMessage, a11yConfig.liveRegionBehavior]);
  
  return (
    <ErrorBoundary>
      <div className="w-full max-w-md mx-auto">
        <form
          ref={formRef}
          {...form.getFormProps()}
          className="bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4"
          aria-labelledby="reset-password-heading"
        >
          <h2 
            id="reset-password-heading" 
            className="text-xl font-bold mb-6 text-gray-800 dark:text-white"
          >
            Reset Your Password
          </h2>
          
          <div className="mb-6">
            <label 
              htmlFor="email" 
              className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
            >
              Email Address
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <input
              ref={emailInputRef}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="your.email@example.com"
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                form.errors.email && form.touched.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              {...form.getFieldProps('email')}
            />
            {form.errors.email && form.touched.email && (
              <p id="email-error" className="text-red-500 text-xs italic mt-1">
                {form.errors.email}
              </p>
            )}
          </div>
          
          {/* Status message display */}
          {(status === 'success' || status === 'error') && (
            <div 
              className={`mb-4 p-3 rounded ${
                status === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-100'
              }`}
              id="reset-password-status"
              role="status"
              aria-live={a11yConfig.liveRegionBehavior}
            >
              {statusMessage}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={!form.isValid || status === 'submitting' || form.security.suspicious}
              aria-label={a11yConfig.ariaLabels.submitButton}
              aria-busy={status === 'submitting' ? 'true' : 'false'}
              className={`
                w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition duration-150 ease-in-out
                ${(!form.isValid || status === 'submitting' || form.security.suspicious) ? 
                  'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {status === 'submitting' ? (
                <span className="flex items-center justify-center">
                  <svg 
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    ></circle>
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : 'Reset Password'}
            </button>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              Remember your password?{' '}
              <a 
                href="/login" 
                className="text-blue-500 hover:text-blue-700 focus:outline-none focus:underline"
              >
                Log in
              </a>
            </p>
          </div>
        </form>
        
        {/* Hidden element for screen reader announcements */}
        <div 
          id="reset-password-status-sr" 
          role="status" 
          aria-live="off" 
          className="sr-only"
        ></div>
      </div>
    </ErrorBoundary>
  );
};

export default ResetPasswordForm;