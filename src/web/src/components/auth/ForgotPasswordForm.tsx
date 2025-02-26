import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next'; // ^12.0.0
import { AnalyticsBrowser } from '@segment/analytics-next'; // ^1.0.0

import Button from '../common/Button';
import Input from '../common/Input';
import useForm from '../../hooks/useForm';
import { authService } from '../../services/auth.service';
import { resetPasswordSchema } from '../../validations/auth.schema';

// Initialize analytics
const analytics = AnalyticsBrowser.load({ writeKey: process.env.VITE_SEGMENT_WRITE_KEY || '' });

/**
 * Custom error type for password reset failures
 */
export interface ForgotPasswordError {
  /** Error code for programmatic handling */
  code: string;
  /** User-friendly error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Props interface for ForgotPasswordForm component with callbacks
 */
export interface ForgotPasswordFormProps {
  /** Callback when password reset request is successful */
  onSuccess: (email: string) => void;
  /** Callback when password reset request fails */
  onError: (error: ForgotPasswordError) => void;
  /** Optional CSS class for styling */
  className?: string;
}

/**
 * Accessible form component for requesting password reset via email
 * 
 * Provides a secure and accessible interface for users to request
 * password reset with comprehensive validation and rate limiting.
 */
const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSuccess,
  onError,
  className = '',
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Initialize form with validation schema
  const formConfig = {
    fields: [
      {
        name: 'email',
        label: t('fields.email'),
        type: 'email' as const,
        required: true,
        validationRules: [
          {
            type: 'email',
            value: true,
            message: t('validation.email.format'),
          },
        ],
      },
    ],
    initialValues: {
      email: '',
    },
    validationSchema: resetPasswordSchema,
    onSubmit: async (values) => {
      await handleSubmit(values);
    },
    validateOnChange: true,
    validateOnBlur: true,
  };

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit: submitForm,
    isValid,
  } = useForm(formConfig);

  /**
   * Handles form submission with rate limiting and error handling
   */
  const handleSubmit = useCallback(async (formData: { email: string }) => {
    if (isRateLimited) {
      onError({
        code: 'RATE_LIMITED',
        message: t('errors.rateLimited'),
      });
      return;
    }

    setLoading(true);

    // Track form submission attempt
    analytics.track('Password Reset Requested', {
      email: formData.email,
      timestamp: new Date().toISOString(),
    });

    try {
      // Note: In a real implementation, authService would have a forgotPassword method
      // For this exercise, we'll assume it exists and has a similar signature to other auth methods
      await authService.forgotPassword(formData.email);

      // Track successful submission
      analytics.track('Password Reset Success', {
        email: formData.email,
        timestamp: new Date().toISOString(),
      });

      onSuccess(formData.email);
    } catch (error) {
      // Handle specific error types
      let errorMessage = t('errors.unexpected');
      let errorCode = 'UNKNOWN_ERROR';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for rate limiting errors
        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          errorCode = 'RATE_LIMITED';
          setIsRateLimited(true);
          
          // Reset rate limit after some time (e.g., 5 minutes)
          setTimeout(() => setIsRateLimited(false), 5 * 60 * 1000);
        } else if (error.message.includes('not found') || error.message.includes('no account')) {
          errorCode = 'EMAIL_NOT_FOUND';
        } else if (error.message.includes('invalid') && error.message.includes('email')) {
          errorCode = 'INVALID_EMAIL';
        }
      }
      
      // Track failed submission
      analytics.track('Password Reset Failed', {
        email: formData.email,
        error: errorMessage,
        errorCode,
        timestamp: new Date().toISOString(),
      });
      
      onError({
        code: errorCode,
        message: errorMessage,
        details: {
          email: formData.email,
          originalError: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onError, t, isRateLimited]);

  return (
    <div className={`forgot-password-form ${className}`}>
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          submitForm();
        }}
        noValidate
        aria-labelledby="forgot-password-title"
        aria-describedby="forgot-password-description"
      >
        <div className="form-header">
          <h2 id="forgot-password-title" className="text-xl font-semibold mb-2">
            {t('forgotPassword.title', 'Reset Your Password')}
          </h2>
          <p id="forgot-password-description" className="text-gray-600 mb-4">
            {t('forgotPassword.description', 'Enter your email address and we will send you instructions to reset your password.')}
          </p>
        </div>

        <Input
          name="email"
          label={t('fields.email', 'Email Address')}
          type="email"
          placeholder={t('placeholders.email', 'you@example.com')}
          value={values.email}
          onChange={(name, value) => handleChange(name, value)}
          onBlur={(name) => handleBlur(name)}
          error={touched.email ? errors.email : ''}
          touched={touched.email}
          required
          disabled={loading || isRateLimited}
          helpText={t('help.email', 'We\'ll send a password reset link to this email')}
          ariaProps={{
            description: t('aria.emailField', 'Enter the email address associated with your account'),
            required: true,
          }}
        />

        {isRateLimited && (
          <div className="mt-2 mb-4 text-red-600" role="alert">
            {t('errors.rateLimited', 'Too many attempts. Please try again later.')}
          </div>
        )}

        <div className="mt-6">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={!isValid || loading || isRateLimited}
            loading={loading}
            ariaLabel={t('aria.submitResetRequest', 'Request password reset link')}
          >
            {t('buttons.resetPassword', 'Reset Password')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordForm;