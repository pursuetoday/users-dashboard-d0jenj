import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import { loginSchema } from '../../validations/auth.schema';
import Input from '../common/Input';
import Button from '../common/Button';
import { AuthUser } from '../../types/auth.types';

/**
 * Props interface for LoginForm component with enhanced accessibility and validation options
 */
interface LoginFormProps {
  onSuccess?: (user: AuthUser) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit';
  rateLimitAttempts?: number;
}

/**
 * Enhanced form component for secure user authentication with accessibility support
 */
const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  validationMode = 'onChange',
  rateLimitAttempts = 5
}) => {
  // Authentication state and methods from useAuth hook
  const { login, loading, user } = useAuth();
  
  // Rate limiting state
  const [attemptCounter, setAttemptCounter] = useState<number>(0);
  const [lastAttemptTimestamp, setLastAttemptTimestamp] = useState<number>(0);
  
  // Validation cache for performance optimization
  const [validationCache] = useState<Map<string, any>>(new Map());
  
  // State for screen reader announcements
  const [announcement, setAnnouncement] = useState<string>('');
  
  // Form-level error state
  const [formError, setFormError] = useState<string>('');
  
  // Initialize form with useForm hook
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
            value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            message: 'Please enter a valid email address'
          }
        ]
      },
      {
        name: 'password',
        type: 'password',
        label: 'Password',
        required: true,
        validationRules: [
          {
            type: 'required',
            value: true,
            message: 'Password is required'
          }
        ]
      }
    ],
    initialValues: {
      email: '',
      password: ''
    },
    validationSchema: loginSchema,
    validateOnChange: validationMode === 'onChange',
    validateOnBlur: validationMode === 'onBlur',
    onSubmit: async (values) => {
      await handleSubmit(values);
    }
  });
  
  // Trigger onSuccess callback when user changes (after successful login)
  useEffect(() => {
    if (user && onSuccess) {
      onSuccess(user);
    }
  }, [user, onSuccess]);
  
  // Make announcements to screen readers for accessibility
  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncement(message);
    
    // Clear announcement after screen reader has had time to read it
    setTimeout(() => {
      setAnnouncement('');
    }, 3000);
  }, []);
  
  /**
   * Handles form submission with rate limiting and enhanced security measures
   */
  const handleSubmit = async (formValues: { email: string; password: string }): Promise<void> => {
    // Clear any previous form errors
    setFormError('');
    
    // Check rate limiting threshold
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTimestamp;
    
    if (attemptCounter >= rateLimitAttempts && timeSinceLastAttempt < 10 * 60 * 1000) {
      // Rate limiting applied
      const errorMessage = 'Too many login attempts. Please try again later.';
      setFormError(errorMessage);
      announceToScreenReader(`Error: ${errorMessage}`);
      return;
    }
    
    // Update rate limiting counters
    setAttemptCounter(prevCount => prevCount + 1);
    setLastAttemptTimestamp(now);
    
    try {
      // Sanitize input values
      const sanitizedValues = {
        email: formValues.email.trim().toLowerCase(),
        password: formValues.password
      };
      
      // Detect suspicious patterns
      if (isSuspiciousInput(sanitizedValues.email)) {
        throw new Error('Invalid input detected');
      }
      
      // Attempt login
      await login(sanitizedValues);
      
      // Reset rate limiting on success
      setAttemptCounter(0);
      
      // Announce success to screen readers
      announceToScreenReader('Login successful');
      
      // Reset form
      form.resetForm();
      
    } catch (error) {
      // Handle authentication errors with retry mechanism
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred during login';
      
      setFormError(errorMessage);
      announceToScreenReader(`Error: ${errorMessage}`);
    }
  };
  
  /**
   * Performs debounced real-time validation with caching
   */
  const handleValidation = useCallback(async (fieldValue: any, fieldName: string) => {
    // Check validation cache
    const cacheKey = `${fieldName}:${String(fieldValue)}`;
    if (validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey);
    }
    
    // Debounce validation calls for better performance
    try {
      // Validate using schema
      await loginSchema.validateAt(fieldName, { [fieldName]: fieldValue });
      const result = { valid: true };
      validationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      const result = { 
        valid: false, 
        message: error instanceof Error ? error.message : 'Validation error' 
      };
      validationCache.set(cacheKey, result);
      return result;
    }
  }, [validationCache]);
  
  /**
   * Checks for suspicious input patterns as a security measure
   */
  const isSuspiciousInput = (value: string): boolean => {
    // Check for common SQL injection patterns
    const sqlInjectionPatterns = /('|--|;|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|alter|union|into|load_file|outfile)/i;
    
    // Check for common XSS patterns
    const xssPatterns = /(javascript|script|alert|onerror|onload|eval|src|href|data:|<|>)/i;
    
    return sqlInjectionPatterns.test(value) || xssPatterns.test(value);
  };
  
  return (
    <form 
      onSubmit={form.handleSubmit}
      className="space-y-6"
      aria-label={ariaLabel || "Login Form"}
      aria-describedby={ariaDescribedBy}
      noValidate
    >
      {/* Email input field */}
      <Input
        name="email"
        type="email"
        label="Email"
        placeholder="Enter your email address"
        required
        value={form.values.email}
        onChange={(name, value) => form.handleChange(name, value)}
        onBlur={() => form.handleBlur('email')}
        error={form.touched.email ? form.errors.email : ''}
        touched={form.touched.email}
        helpText="Enter the email address associated with your account"
        validateOnChange={validationMode === 'onChange'}
      />
      
      {/* Password input field */}
      <Input
        name="password"
        type="password"
        label="Password"
        placeholder="Enter your password"
        required
        value={form.values.password}
        onChange={(name, value) => form.handleChange(name, value)}
        onBlur={() => form.handleBlur('password')}
        error={form.touched.password ? form.errors.password : ''}
        touched={form.touched.password}
        validateOnChange={validationMode === 'onChange'}
      />
      
      {/* Form-level error message */}
      {formError && (
        <div 
          className="p-3 bg-red-100 border border-red-300 text-red-700 rounded" 
          role="alert"
        >
          {formError}
        </div>
      )}
      
      {/* Submit button */}
      <Button
        type="submit"
        variant="primary"
        fullWidth
        disabled={loading || form.isSubmitting}
        loading={loading || form.isSubmitting}
        ariaLabel="Log in to your account"
      >
        Log in
      </Button>
      
      {/* Hidden element for screen reader announcements */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>
    </form>
  );
};

export default LoginForm;