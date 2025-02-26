/**
 * Advanced utility functions for secure form validation and data validation
 * with enhanced security measures and input sanitization.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import { object, string } from 'yup'; // ^1.0.0
import { FormField } from '../types/form.types';
import { VALIDATION_RULES, VALIDATION_MESSAGES } from '../constants/validation.constants';

/**
 * Sanitizes input to prevent XSS attacks
 * @param value - The input value to sanitize
 * @returns Sanitized string value
 */
const sanitizeInput = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert to string if not already
  const stringValue = String(value);
  
  // Basic XSS prevention by replacing HTML special chars
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Checks if a field value is empty or null
 * @param value - The value to check
 * @returns Boolean indicating if the value is empty
 */
const isEmpty = (value: any): boolean => {
  return value === undefined || value === null || value === '' || 
    (typeof value === 'string' && value.trim() === '');
};

/**
 * Logs validation attempts for security auditing
 * @param fieldName - The name of the field being validated
 * @param isValid - Whether validation passed
 * @param errorMessage - The error message if validation failed
 */
const logValidationAttempt = (fieldName: string, isValid: boolean, errorMessage?: string): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(
      `Field validation: ${fieldName}, Valid: ${isValid}${errorMessage ? `, Error: ${errorMessage}` : ''}`
    );
  }
  
  // In a real application, we might want to send this to a monitoring service
  // or append to security logs, especially for sensitive fields
};

/**
 * Enhanced field validation with security measures and input sanitization
 * @param field - The form field configuration
 * @param value - The field value to validate
 * @returns Promise resolving to error message or null if valid
 */
export const validateField = async (field: FormField, value: any): Promise<string | null> => {
  // Sanitize input to prevent XSS
  const sanitizedValue = sanitizeInput(value);
  
  // Type check for security
  if (value !== undefined && typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
    return 'Invalid data type provided';
  }
  
  // Check if required
  if (field.required && isEmpty(value)) {
    logValidationAttempt(field.name, false, VALIDATION_MESSAGES.REQUIRED);
    return VALIDATION_MESSAGES.REQUIRED;
  }
  
  // Apply validation rules with security context
  if (field.validationRules && field.validationRules.length > 0) {
    for (const rule of field.validationRules) {
      // Skip further validation if value is empty but field is not required
      if (isEmpty(value) && !field.required) {
        continue;
      }
      
      // Handle custom validator
      if (rule.validator) {
        try {
          const result = rule.validator(value);
          if (result instanceof Promise) {
            const isValid = await result;
            if (!isValid) {
              logValidationAttempt(field.name, false, rule.message);
              return rule.message;
            }
          } else if (!result) {
            logValidationAttempt(field.name, false, rule.message);
            return rule.message;
          }
        } catch (error) {
          logValidationAttempt(field.name, false, 'Validation error occurred');
          return 'An error occurred during validation';
        }
      }
      
      // Common validation types
      switch (rule.type) {
        case 'minLength':
          if (typeof value === 'string' && value.length < rule.value) {
            logValidationAttempt(field.name, false, rule.message);
            return rule.message;
          }
          break;
        case 'maxLength':
          if (typeof value === 'string' && value.length > rule.value) {
            logValidationAttempt(field.name, false, rule.message);
            return rule.message;
          }
          break;
        case 'pattern':
          if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
            logValidationAttempt(field.name, false, rule.message);
            return rule.message;
          }
          break;
        default:
          // Handle other validation types
          break;
      }
    }
  }
  
  logValidationAttempt(field.name, true);
  return null;
};

/**
 * Enhanced email validation with domain verification and security checks
 * @param email - Email string to validate
 * @returns Promise resolving to error message or null if valid
 */
export const validateEmail = async (email: string): Promise<string | null> => {
  // Sanitize email input
  const sanitizedEmail = sanitizeInput(email);
  
  // Create validation schema with security checks
  const emailSchema = object({
    email: string()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .max(VALIDATION_RULES.EMAIL.maxLength, VALIDATION_MESSAGES.EMAIL_MAX_LENGTH)
      .matches(
        new RegExp(VALIDATION_RULES.EMAIL.pattern),
        VALIDATION_MESSAGES.EMAIL_FORMAT
      )
      .email(VALIDATION_MESSAGES.EMAIL_FORMAT)
  });
  
  try {
    await emailSchema.validate({ email: sanitizedEmail });
    
    // Email format is valid, now perform enhanced security checks
    
    // 1. Check email local part complexity
    const [localPart] = sanitizedEmail.split('@');
    if (localPart.length < 3) {
      return 'Email username is too short';
    }
    
    // 2. Verify domain existence (in a real app, this would be an actual DNS check)
    // This is a simplified mock implementation
    const domainVerification = await mockDomainVerification(sanitizedEmail);
    if (!domainVerification.valid) {
      return domainVerification.message;
    }
    
    // 3. Check against disposable email domains (simplified mock implementation)
    const disposableCheck = checkDisposableEmailDomain(sanitizedEmail);
    if (disposableCheck) {
      return 'Disposable email addresses are not allowed';
    }
    
    // Email passed all validation checks
    logValidationAttempt('email', true);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : VALIDATION_MESSAGES.EMAIL_FORMAT;
    logValidationAttempt('email', false, message);
    return message;
  }
};

/**
 * Enhanced password validation with strength assessment and security checks
 * @param password - Password string to validate
 * @returns Promise resolving to error message or null if valid
 */
export const validatePassword = async (password: string): Promise<string | null> => {
  // Create validation schema with security checks
  const passwordSchema = object({
    password: string()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .min(VALIDATION_RULES.PASSWORD.minLength, VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH)
      .matches(/[A-Z]/, VALIDATION_MESSAGES.PASSWORD_UPPERCASE)
      .matches(/[0-9]/, VALIDATION_MESSAGES.PASSWORD_NUMBER)
      .matches(/[!@#$%^&*]/, VALIDATION_MESSAGES.PASSWORD_SPECIAL)
  });
  
  try {
    await passwordSchema.validate({ password });
    
    // Password format is valid, now perform enhanced security checks
    
    // 1. Calculate password strength score (0-100)
    const strengthScore = calculatePasswordStrength(password);
    if (strengthScore < 50) {
      return 'Password is too weak. Please use a stronger combination.';
    }
    
    // 2. Check against common password database (simplified mock implementation)
    const isCommon = await checkCommonPassword(password);
    if (isCommon) {
      return 'This password is commonly used and vulnerable to attacks. Please choose a different password.';
    }
    
    // 3. Validate character distribution
    if (!hasGoodCharacterDistribution(password)) {
      return 'Password characters should be more evenly distributed';
    }
    
    // Password passed all validation checks
    logValidationAttempt('password', true);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid password format';
    logValidationAttempt('password', false, message);
    return message;
  }
};

/**
 * Enhanced name validation with Unicode support and format standardization
 * @param name - Name string to validate
 * @returns Promise resolving to error message or null if valid
 */
export const validateName = async (name: string): Promise<string | null> => {
  // Sanitize name input
  const sanitizedName = sanitizeInput(name);
  
  // Create validation schema
  const nameSchema = object({
    name: string()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .min(VALIDATION_RULES.NAME.minLength, VALIDATION_MESSAGES.NAME_LENGTH)
      .max(VALIDATION_RULES.NAME.maxLength, VALIDATION_MESSAGES.NAME_LENGTH)
      .matches(
        new RegExp(VALIDATION_RULES.NAME.pattern),
        VALIDATION_MESSAGES.NAME_FORMAT
      )
  });
  
  try {
    await nameSchema.validate({ name: sanitizedName });
    
    // Name format is valid, now perform enhanced checks
    
    // 1. Check for valid Unicode characters beyond basic ASCII
    if (!/^[\p{L}\s]+$/u.test(sanitizedName)) {
      return 'Name contains invalid characters';
    }
    
    // 2. Check for restricted characters
    if (/[0-9!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]/.test(sanitizedName)) {
      return 'Name cannot contain numbers or special characters';
    }
    
    // Name passed all validation checks
    logValidationAttempt('name', true);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : VALIDATION_MESSAGES.NAME_FORMAT;
    logValidationAttempt('name', false, message);
    return message;
  }
};

// Helper functions for validation

/**
 * Mocks verification of email domain existence
 * In a production environment, this would perform actual DNS lookup
 * @param email - Email to verify
 * @returns Promise resolving to domain verification result
 */
const mockDomainVerification = async (email: string): Promise<{ valid: boolean; message?: string }> => {
  const domain = email.split('@')[1];
  
  // Mock implementation - in production this would be a real DNS check
  // Simulating network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Blacklist certain domains for demo purposes
  const blacklistedDomains = ['example.com', 'test.com', 'invalid.com'];
  if (blacklistedDomains.includes(domain)) {
    return { valid: false, message: 'Email domain is not accepted' };
  }
  
  return { valid: true };
};

/**
 * Checks if email uses a disposable email domain
 * @param email - Email to check
 * @returns Boolean indicating if email uses a disposable domain
 */
const checkDisposableEmailDomain = (email: string): boolean => {
  const domain = email.split('@')[1];
  
  // Simplified check against common disposable email domains
  const disposableDomains = [
    'mailinator.com',
    'tempmail.com',
    'throwawaymail.com',
    'guerrillamail.com',
    'trashmail.com'
  ];
  
  return disposableDomains.includes(domain);
};

/**
 * Calculates password strength score from 0-100
 * @param password - Password to evaluate
 * @returns Numeric score from 0-100 representing password strength
 */
const calculatePasswordStrength = (password: string): number => {
  let score = 0;
  
  // Length contribution: up to 25 points
  score += Math.min(25, password.length * 2);
  
  // Character variety contribution: up to 50 points
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigits = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  
  const charVariety = [hasLowercase, hasUppercase, hasDigits, hasSpecial]
    .filter(Boolean).length;
  
  score += charVariety * 12.5;
  
  // Complexity patterns contribution: up to 25 points
  const complexityPatterns = [
    /[a-z][A-Z]|[A-Z][a-z]/,    // Lowercase followed by uppercase or vice versa
    /[a-zA-Z][0-9]|[0-9][a-zA-Z]/,  // Letter followed by digit or vice versa
    /[a-zA-Z0-9][^a-zA-Z0-9]|[^a-zA-Z0-9][a-zA-Z0-9]/  // Alphanumeric followed by special or vice versa
  ];
  
  complexityPatterns.forEach(pattern => {
    if (pattern.test(password)) {
      score += 8.33;
    }
  });
  
  return Math.min(100, Math.round(score));
};

/**
 * Mocks checking password against a database of common passwords
 * In production, this would check against an actual database
 * @param password - Password to check
 * @returns Promise resolving to boolean indicating if password is common
 */
const checkCommonPassword = async (password: string): Promise<boolean> => {
  // Simplified mock implementation - in production this would check against a real database
  // Simulating network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const commonPasswords = [
    'password123',
    'admin123',
    'letmein',
    '12345678',
    'qwerty123',
    'welcome1',
    'Password1!',
    'P@ssw0rd'
  ];
  
  return commonPasswords.includes(password);
};

/**
 * Checks if password has good character distribution
 * Helps prevent patterns like "aaaaBBBB1111!!!!"
 * @param password - Password to check
 * @returns Boolean indicating if password has good character distribution
 */
const hasGoodCharacterDistribution = (password: string): boolean => {
  // Count repeated sequential characters (e.g., "aaa")
  let repeatedChars = 0;
  for (let i = 2; i < password.length; i++) {
    if (password[i] === password[i-1] && password[i] === password[i-2]) {
      repeatedChars++;
    }
  }
  
  // Check for keyboard patterns like "qwerty" or "12345"
  const keyboardPatterns = [
    /qwert/i, /asdfg/i, /zxcvb/i, /yuiop/i, /hjkl/i, /nm/i,
    /12345/i, /67890/i, /abcde/i, /fghij/i, /klmno/i, /pqrst/i, /uvwxy/i
  ];
  
  let patternFound = false;
  keyboardPatterns.forEach(pattern => {
    if (pattern.test(password)) {
      patternFound = true;
    }
  });
  
  return repeatedChars <= 1 && !patternFound;
};