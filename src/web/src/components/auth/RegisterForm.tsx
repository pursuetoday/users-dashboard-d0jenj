/**
 * User Registration Form Component
 * 
 * A secure and accessible registration form component that implements comprehensive validation,
 * error handling, internationalization support, and theme integration for user signup.
 * 
 * Features:
 * - Comprehensive validation using Yup schema
 * - Secure input handling with XSS prevention
 * - Password strength indicator
 * - Real-time field validation
 * - Internationalization support
 * - Theme integration (dark/light modes)
 * - Comprehensive error handling
 * - WCAG compliant accessibility features
 * - Built with Tailwind UI components
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import { yupResolver } from '@hookform/resolvers/yup'; // ^3.0.0
import { useTranslation } from 'react-i18next'; // ^12.0.0
import { RegisterData } from '../../types/auth.types';
import { registerSchema } from '../../validations/auth.schema';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

/**
 * Enhanced registration form component with security, accessibility, and internationalization
 */
const RegisterForm: React.FC = () => {
  // Initialize i18n
  const { t } = useTranslation();
  
  // Access theme context
  const { theme } = useTheme();
  
  // Access auth context
  const { register: registerUser } = useAuth();
  
  // Local state for server errors not tied to specific fields
  const [serverError, setServerError] = useState<string | null>(null);

  // Initialize form with Yup schema validation
  const formMethods = useForm<RegisterData>({
    resolver: yupResolver(registerSchema),
    mode: 'onBlur' // Validate fields when they lose focus
  });
  
  const { 
    register, 
    handleSubmit: submitForm, 
    formState: { errors, isSubmitting }, 
    setError, 
    watch,
    reset 
  } = formMethods;
  
  // Watch password field for strength indicator
  const password = watch('password');

  /**
   * Handles form submission with enhanced security and error handling
   * 
   * @param data - The validated form data
   * @returns Promise that resolves on successful registration with error handling
   */
  const handleSubmit = useCallback(async (data: RegisterData): Promise<void> => {
    try {
      // Clear any previous server errors
      setServerError(null);
      
      // Sanitize input data to prevent XSS attacks
      const sanitizedData: RegisterData = {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        firstName: data.firstName.trim().replace(/[^a-zA-Z\s]/g, ''),
        lastName: data.lastName.trim().replace(/[^a-zA-Z\s]/g, '')
      };
      
      // Check for rate limiting constraints
      const rateLimitKey = `registration_attempts_${new Date().toDateString()}`;
      const attemptCount = parseInt(localStorage.getItem(rateLimitKey) || '0', 10);
      
      if (attemptCount > 5) {
        throw new Error(t('auth.register.rateLimitExceeded', 'Too many registration attempts. Please try again later.'));
      }
      
      // Update rate limiting counter
      localStorage.setItem(rateLimitKey, String(attemptCount + 1));
      
      // Track analytics for form submission
      if (typeof window !== 'undefined' && 'gtag' in window) {
        // @ts-ignore - gtag may not be in Window interface
        window.gtag('event', 'registration_attempt', {
          event_category: 'authentication',
          event_label: 'register_form'
        });
      }
      
      // Call register function with validated data
      await registerUser(sanitizedData);
      
      // Track successful registration
      if (typeof window !== 'undefined' && 'gtag' in window) {
        // @ts-ignore - gtag may not be in Window interface
        window.gtag('event', 'registration_success', {
          event_category: 'authentication',
          event_label: 'register_form'
        });
      }
      
      // Reset form on successful registration
      reset();
      
      // Show success message
      // Here you would typically handle redirect or display success state
      // For now we'll reset the form as a visual indicator of success
      
    } catch (error) {
      // Handle registration errors with detailed feedback
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Map specific error messages to form fields
        if (errorMessage.toLowerCase().includes('email')) {
          setError('email', { 
            type: 'server', 
            message: errorMessage 
          });
        } else if (errorMessage.toLowerCase().includes('password')) {
          setError('password', { 
            type: 'server', 
            message: errorMessage 
          });
        } else if (errorMessage.toLowerCase().includes('name')) {
          if (errorMessage.toLowerCase().includes('first')) {
            setError('firstName', {
              type: 'server',
              message: errorMessage
            });
          } else {
            setError('lastName', {
              type: 'server',
              message: errorMessage
            });
          }
        } else {
          // Set general server error
          setServerError(errorMessage);
        }
      } else {
        setServerError(errorMessage);
      }
      
      // Track registration error
      if (typeof window !== 'undefined' && 'gtag' in window) {
        // @ts-ignore - gtag may not be in Window interface
        window.gtag('event', 'registration_error', {
          event_category: 'authentication',
          event_label: errorMessage
        });
      }
      
      // Log errors for monitoring
      console.error('Registration error:', error);
    }
  }, [registerUser, reset, setError, t]);

  /**
   * Calculate password strength and render indicator
   * @returns Password strength indicator UI
   */
  const renderPasswordStrength = useCallback(() => {
    if (!password) return null;
    
    // Calculate strength score (0-4)
    let strength = 0;
    let strengthText = t('auth.register.passwordWeak', 'Weak');
    let strengthClass = 'bg-red-500';
    
    // Check various password criteria
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 1;
    
    // Set display properties based on strength
    if (strength === 4) {
      strengthText = t('auth.register.passwordStrong', 'Strong');
      strengthClass = 'bg-green-500';
    } else if (strength === 3) {
      strengthText = t('auth.register.passwordGood', 'Good');
      strengthClass = 'bg-blue-500';
    } else if (strength === 2) {
      strengthText = t('auth.register.passwordModerate', 'Moderate');
      strengthClass = 'bg-yellow-500';
    }
    
    return (
      <div className="mt-1" aria-live="polite">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs" id="password-strength-text">{strengthText}</span>
        </div>
        <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full">
          <div 
            className={`h-1 rounded-full transition-all duration-300 ${strengthClass}`} 
            style={{ width: `${(strength / 4) * 100}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }, [password, t]);

  return (
    <div 
      className={`w-full max-w-md mx-auto rounded-lg shadow-md p-6 
        ${theme.isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
    >
      <h2 className="text-2xl font-bold mb-6" id="register-form-title">
        {t('auth.register.title', 'Create an Account')}
      </h2>
      
      {/* Display server errors */}
      {serverError && (
        <div 
          className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:text-red-200 dark:border-red-700" 
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </div>
      )}
      
      <form 
        onSubmit={submitForm(handleSubmit)} 
        noValidate 
        className="space-y-4"
        aria-labelledby="register-form-title"
      >
        {/* First Name Field */}
        <div>
          <label htmlFor="firstName" className="block mb-1 font-medium">
            {t('auth.register.firstName', 'First Name')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="firstName"
            type="text"
            {...register('firstName')}
            className={`w-full px-3 py-2 border rounded-md 
              ${errors.firstName ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} 
              ${theme.isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-invalid={errors.firstName ? 'true' : 'false'}
            aria-required="true"
            disabled={isSubmitting}
            data-testid="register-firstName"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400" role="alert">
              {errors.firstName.message}
            </p>
          )}
        </div>
        
        {/* Last Name Field */}
        <div>
          <label htmlFor="lastName" className="block mb-1 font-medium">
            {t('auth.register.lastName', 'Last Name')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            {...register('lastName')}
            className={`w-full px-3 py-2 border rounded-md 
              ${errors.lastName ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} 
              ${theme.isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-invalid={errors.lastName ? 'true' : 'false'}
            aria-required="true"
            disabled={isSubmitting}
            data-testid="register-lastName"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400" role="alert">
              {errors.lastName.message}
            </p>
          )}
        </div>
        
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block mb-1 font-medium">
            {t('auth.register.email', 'Email Address')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={`w-full px-3 py-2 border rounded-md 
              ${errors.email ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} 
              ${theme.isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-required="true"
            disabled={isSubmitting}
            data-testid="register-email"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        
        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block mb-1 font-medium">
            {t('auth.register.password', 'Password')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className={`w-full px-3 py-2 border rounded-md 
              ${errors.password ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} 
              ${theme.isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby="password-requirements"
            aria-required="true"
            disabled={isSubmitting}
            data-testid="register-password"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400" role="alert">
              {errors.password.message}
            </p>
          )}
          
          {/* Password strength indicator */}
          {password && renderPasswordStrength()}
        </div>
        
        {/* Password Requirements */}
        <div 
          className={`text-sm ${theme.isDark ? 'text-gray-300' : 'text-gray-600'}`} 
          id="password-requirements"
        >
          <p>{t('auth.register.passwordRequirements', 'Password must:')}</p>
          <ul className="list-disc list-inside ml-2 mt-1">
            <li>{t('auth.register.passwordLength', 'Be at least 8 characters')}</li>
            <li>{t('auth.register.passwordUppercase', 'Include at least one uppercase letter (A-Z)')}</li>
            <li>{t('auth.register.passwordNumber', 'Include at least one number (0-9)')}</li>
            <li>{t('auth.register.passwordSpecial', 'Include at least one special character (!@#$%^&*)')}</li>
          </ul>
        </div>
        
        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-2 px-4 rounded-md font-medium mt-4
            ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-600 active:bg-blue-700'} 
            bg-blue-500 text-white transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
          aria-busy={isSubmitting}
          data-testid="register-submit"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('auth.register.submitting', 'Creating Account...')}
            </span>
          ) : (
            <span>{t('auth.register.submit', 'Create Account')}</span>
          )}
        </button>
        
        {/* Login Link */}
        <div className="text-center mt-4">
          <p>
            {t('auth.register.alreadyHaveAccount', 'Already have an account?')}{' '}
            <a 
              href="/login" 
              className={`${theme.isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} 
                focus:outline-none focus:underline`}
              data-testid="register-login-link"
            >
              {t('auth.register.login', 'Sign in')}
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;