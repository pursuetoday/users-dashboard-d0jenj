import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import ResetPasswordForm from '../../components/auth/ResetPasswordForm';
import Alert from '../../components/common/Alert';
import useAuth from '../../hooks/useAuth';

/**
 * Enhanced page component for secure password reset functionality with rate limiting and monitoring
 * Provides a user-friendly interface for initiating password reset with comprehensive 
 * security measures and accessibility features.
 */
const ResetPasswordPage: React.FC = () => {
  // State for tracking success and error messages
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Navigation for redirecting after successful reset
  const navigate = useNavigate();
  
  // Get auth utilities and state
  const { loading, resetAttempts, securityLog } = useAuth();
  
  // Ref to store redirect timer
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Securely handles successful password reset with monitoring
   * @param message - Success message from the server
   */
  const handleSuccess = useCallback((message: string) => {
    // Log successful password reset attempt
    if (securityLog) {
      securityLog('password_reset_success', { timestamp: new Date().toISOString() });
    }
    
    // Set success message
    setSuccessMessage(message);
    setErrorMessage('');
    
    // Clear any existing timer
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }
    
    // Redirect to login page after a delay for security purposes
    redirectTimerRef.current = setTimeout(() => {
      navigate('/login', { 
        state: { 
          notification: {
            type: 'success',
            message: 'Password reset email sent. Please check your inbox.'
          } 
        } 
      });
    }, 3000);
  }, [navigate, securityLog]);

  /**
   * Handles password reset errors with security monitoring
   * @param error - Error type from the form component
   */
  const handleError = useCallback((error: string) => {
    // Log error details securely
    if (securityLog) {
      securityLog('password_reset_error', { 
        error, 
        timestamp: new Date().toISOString() 
      });
    }
    
    // Map error types to user-friendly messages
    let displayMessage = 'An error occurred while processing your request. Please try again.';
    
    switch (error) {
      case 'VALIDATION_ERROR':
        displayMessage = 'Please check your email address and try again.';
        break;
      case 'NETWORK_ERROR':
        displayMessage = 'Network error. Please check your connection and try again.';
        break;
      case 'USER_NOT_FOUND':
        // Intentionally use the same message as generic errors for security
        displayMessage = 'If your email is registered, you will receive a password reset link.';
        break;
      case 'RATE_LIMITED':
        displayMessage = 'Too many attempts. Please try again later.';
        break;
      case 'SECURITY_VIOLATION':
        displayMessage = 'Security check failed. Please try again later.';
        break;
    }
    
    // Set error message and clear success
    setErrorMessage(displayMessage);
    setSuccessMessage('');
    
  }, [securityLog]);
  
  /**
   * Handles rate limiting with monitoring
   * @param attempts - Number of attempts made
   */
  const handleRateLimit = useCallback((attempts: number) => {
    // Log rate limiting
    if (securityLog) {
      securityLog('password_reset_rate_limited', { 
        attempts, 
        timestamp: new Date().toISOString() 
      });
    }
    
    // Set appropriate error message
    setErrorMessage('Too many password reset attempts. Please try again later.');
    setSuccessMessage('');
    
  }, [securityLog]);
  
  /**
   * Handles security violations with monitoring
   * @param violation - Type of security violation
   */
  const handleSecurityViolation = useCallback((violation: string) => {
    // Log security violation
    if (securityLog) {
      securityLog('password_reset_security_violation', { 
        violation, 
        timestamp: new Date().toISOString() 
      });
    }
    
    // Set appropriate error message
    setErrorMessage('Security check failed. Please try again later.');
    setSuccessMessage('');
    
  }, [securityLog]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  return (
    <AuthLayout title="Reset Your Password">
      {/* Show success message if present */}
      {successMessage && (
        <Alert 
          variant="success" 
          className="mb-4"
          aria-live="assertive"
        >
          {successMessage}
        </Alert>
      )}
      
      {/* Show error message if present */}
      {errorMessage && (
        <Alert 
          variant="error" 
          className="mb-4"
          aria-live="assertive"
        >
          {errorMessage}
        </Alert>
      )}
      
      {/* Password reset form with comprehensive security features */}
      <ResetPasswordForm
        onSuccess={handleSuccess}
        onError={handleError}
        onRateLimit={handleRateLimit}
        onSecurityViolation={handleSecurityViolation}
      />
    </AuthLayout>
  );
};

export default ResetPasswordPage;