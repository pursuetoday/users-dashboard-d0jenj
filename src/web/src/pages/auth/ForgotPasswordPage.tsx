import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsBrowser } from '@segment/analytics-next';

import AuthLayout from '../../components/layout/AuthLayout';
import ForgotPasswordForm, { ForgotPasswordError } from '../../components/auth/ForgotPasswordForm';
import { useAuth } from '../../hooks/useAuth';

// Initialize analytics
const analytics = AnalyticsBrowser.load({ writeKey: process.env.VITE_SEGMENT_WRITE_KEY || '' });

/**
 * Page component that renders the forgot password interface with enhanced security and accessibility features
 * 
 * @returns JSX.Element - Rendered forgot password page with security measures and accessibility support
 */
const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, checkRateLimit } = useAuth();
  
  // State for feedback messages
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Accessibility announcement for screen readers
  const [announcement, setAnnouncement] = useState<string>('');
  
  // If user is already authenticated, redirect to dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  /**
   * Handles successful password reset request with analytics and user feedback
   * 
   * @param email - The email address that requested password reset
   */
  const handleSuccess = useCallback((email: string): void => {
    // Track successful password reset request with analytics
    analytics.track('Password Reset Requested', {
      email,
      status: 'success',
      timestamp: new Date().toISOString()
    });
    
    // Set success message
    const message = t('forgotPassword.successMessage', 
      'Password reset instructions have been sent to your email. Please check your inbox.');
    setSuccessMessage(message);
    setErrorMessage('');
    
    // Set announcement for screen readers
    setAnnouncement(message);
    
    // Reset rate limit counter on success
    if (typeof checkRateLimit === 'function') {
      checkRateLimit('resetPassword', 'reset');
    }
    
    // Log success for monitoring
    console.info('Password reset requested successfully for:', email);
    
    // Navigate to login page after delay with email pre-filled
    setTimeout(() => {
      navigate('/login', { state: { email } });
    }, 3000);
  }, [navigate, t, checkRateLimit]);
  
  /**
   * Handles password reset request errors with proper user feedback
   * 
   * @param error - Error object from form submission
   */
  const handleError = useCallback((error: ForgotPasswordError): void => {
    // Track error event with analytics
    analytics.track('Password Reset Failed', {
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    });
    
    // Set error message
    setErrorMessage(error.message);
    setSuccessMessage('');
    
    // Set announcement for screen readers
    setAnnouncement(`Error: ${error.message}`);
    
    // Update rate limit counter on error if rate limiting is enabled
    if (typeof checkRateLimit === 'function' && error.code !== 'RATE_LIMITED') {
      checkRateLimit('resetPassword', 'increment');
    }
    
    // Log error for monitoring
    console.error('Password reset error:', error);
  }, [checkRateLimit]);
  
  return (
    <AuthLayout 
      title={t('forgotPassword.pageTitle', 'Reset Your Password')}
      testId="forgot-password-page"
    >
      {/* Success message with ARIA alert */}
      {successMessage && (
        <div 
          className="mb-4 p-3 bg-green-100 text-green-800 rounded-md" 
          role="alert"
          aria-live="assertive"
        >
          {successMessage}
        </div>
      )}
      
      {/* Error message with ARIA alert */}
      {errorMessage && (
        <div 
          className="mb-4 p-3 bg-red-100 text-red-800 rounded-md" 
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </div>
      )}
      
      {/* Description text for the page */}
      <p className="text-gray-600 mb-6">
        {t('forgotPassword.description', 
          'Enter your email address below and we\'ll send you instructions to reset your password.')}
      </p>
      
      {/* Forgot password form component */}
      <ForgotPasswordForm
        onSuccess={handleSuccess}
        onError={handleError}
        className="mt-4"
      />
      
      {/* Navigation back to login */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-blue-600 hover:text-blue-800 font-medium"
          aria-label={t('forgotPassword.backToLogin', 'Back to login')}
        >
          {t('forgotPassword.backToLogin', 'Back to login')}
        </button>
      </div>
      
      {/* Hidden element for screen readers to announce status changes */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;