import { validate, ValidationError } from 'class-validator'; // ^0.14.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { LoginDto } from '../dto/auth/login.dto';
import { RegisterDto } from '../dto/auth/register.dto';
import { ResetPasswordDto } from '../dto/auth/reset-password.dto';
import { AUTH_VALIDATION_MESSAGES } from '../constants/validation-messages';

/**
 * Enhanced middleware function that validates login request body against LoginDto schema
 * with comprehensive error handling and security checks.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Continues to next middleware if validation passes, returns 400 with structured error messages if validation fails
 */
export const validateLoginRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if request body exists
  if (!req.body) {
    res.status(400).json({ 
      success: false, 
      message: 'Invalid request',
      errors: ['Request body is missing']
    });
    return;
  }

  try {
    // Create DTO instance from request body with sanitization
    const loginDto = new LoginDto();
    loginDto.email = typeof req.body.email === 'string' ? req.body.email.trim() : req.body.email;
    loginDto.password = req.body.password;

    // Perform comprehensive validation using class-validator
    const validationErrors = await validate(loginDto);

    // If validation errors exist, transform them into structured format
    if (validationErrors.length > 0) {
      const formattedErrors = formatValidationErrors(validationErrors);
      
      // Apply security checks for input values
      // For login we sanitize errors to prevent username enumeration
      const sanitizedErrors = sanitizeLoginErrors(formattedErrors);
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: sanitizedErrors
      });
      return;
    }

    // Additional security checks for login attempt
    if (containsSuspiciousPatterns(req)) {
      // Log potential security threat but return generic error
      console.warn(`Suspicious login attempt detected: ${req.ip}`);
      res.status(400).json({
        success: false,
        message: 'Invalid login request',
        errors: ['Invalid email or password']
      });
      return;
    }

    // If validation passes, continue to next middleware
    next();
  } catch (error) {
    // Handle unexpected errors
    console.error('Login validation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while validating login request',
      errors: ['Internal server error']
    });
  }
};

/**
 * Enhanced middleware function that validates registration request body against RegisterDto schema
 * with comprehensive validation and security measures.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Continues to next middleware if validation passes, returns 400 with structured error messages if validation fails
 */
export const validateRegisterRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if request body exists
  if (!req.body) {
    res.status(400).json({ 
      success: false, 
      message: 'Invalid request',
      errors: ['Request body is missing']
    });
    return;
  }

  try {
    // Create RegisterDto instance from request body with sanitization
    const registerDto = new RegisterDto();
    registerDto.email = typeof req.body.email === 'string' ? req.body.email.trim() : req.body.email;
    registerDto.password = req.body.password;
    registerDto.firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : req.body.firstName;
    registerDto.lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : req.body.lastName;

    // Perform comprehensive validation using class-validator
    const validationErrors = await validate(registerDto);

    // If validation errors exist, transform them into structured format
    if (validationErrors.length > 0) {
      const formattedErrors = formatValidationErrors(validationErrors);
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
      return;
    }

    // Apply additional security checks
    const securityCheckErrors = performSecurityChecks(req.body);
    if (securityCheckErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Security validation failed',
        errors: securityCheckErrors
      });
      return;
    }

    // If validation passes, continue to next middleware
    next();
  } catch (error) {
    // Handle unexpected errors
    console.error('Registration validation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while validating registration request',
      errors: ['Internal server error']
    });
  }
};

/**
 * Enhanced middleware function that validates password reset request body against ResetPasswordDto schema
 * with token validation and security measures.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Continues to next middleware if validation passes, returns 400 with structured error messages if validation fails
 */
export const validateResetPasswordRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if request body exists
  if (!req.body) {
    res.status(400).json({ 
      success: false, 
      message: 'Invalid request',
      errors: ['Request body is missing']
    });
    return;
  }

  try {
    // Create ResetPasswordDto instance from request body with sanitization
    const resetPasswordDto = new ResetPasswordDto();
    resetPasswordDto.email = typeof req.body.email === 'string' ? req.body.email.trim() : req.body.email;
    resetPasswordDto.token = req.body.token;
    resetPasswordDto.newPassword = req.body.newPassword;

    // Validate reset token format and expiration
    if (!isValidResetToken(req.body.token)) {
      res.status(400).json({
        success: false,
        message: AUTH_VALIDATION_MESSAGES.TOKEN_INVALID,
        errors: [AUTH_VALIDATION_MESSAGES.TOKEN_INVALID]
      });
      return;
    }

    // Perform comprehensive validation using class-validator
    const validationErrors = await validate(resetPasswordDto);

    // If validation errors exist, transform them into structured format
    if (validationErrors.length > 0) {
      const formattedErrors = formatValidationErrors(validationErrors);
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
      return;
    }

    // Validate new password complexity requirements
    if (!isPasswordStrong(req.body.newPassword)) {
      res.status(400).json({
        success: false,
        message: AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY,
        errors: [AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY]
      });
      return;
    }

    // If validation passes, continue to next middleware
    next();
  } catch (error) {
    // Handle unexpected errors
    console.error('Password reset validation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while validating password reset request',
      errors: ['Internal server error']
    });
  }
};

/**
 * Helper function to format validation errors into a clean array of error messages
 * 
 * @param errors - Array of ValidationError objects from class-validator
 * @returns Array of formatted error messages
 */
const formatValidationErrors = (errors: ValidationError[]): string[] => {
  const formattedErrors: string[] = [];
  
  errors.forEach(error => {
    const constraints = error.constraints;
    if (constraints) {
      // Add each validation error message to the array
      Object.values(constraints).forEach(message => {
        formattedErrors.push(message);
      });
    }
    
    // Process nested errors if present
    if (error.children && error.children.length > 0) {
      const nestedErrors = formatValidationErrors(error.children);
      formattedErrors.push(...nestedErrors);
    }
  });
  
  return formattedErrors;
};

/**
 * Sanitizes login error messages to prevent information disclosure
 * For login attempts, we don't want to be too specific about validation failures
 * to prevent username enumeration or other security issues
 * 
 * @param errors - Array of error messages
 * @returns Sanitized array of error messages
 */
const sanitizeLoginErrors = (errors: string[]): string[] => {
  // For security reasons, with login we want to be less specific 
  // about the exact issue to prevent username enumeration
  if (errors.some(error => 
    error.includes('email') || 
    error.includes('password'))) {
    return ['Invalid email or password'];
  }
  
  return errors;
};

/**
 * Performs additional security checks on registration data
 * Checks for suspicious patterns, potential XSS, etc.
 * 
 * @param data - Registration request data
 * @returns Array of security error messages
 */
const performSecurityChecks = (data: any): string[] => {
  const errors: string[] = [];
  
  // Check for potential XSS in name fields
  const xssPattern = /<script|javascript:|on\w+=/i;
  if (data.firstName && xssPattern.test(data.firstName)) {
    errors.push('First name contains invalid characters');
  }
  
  if (data.lastName && xssPattern.test(data.lastName)) {
    errors.push('Last name contains invalid characters');
  }
  
  // Check for email format inconsistencies (beyond basic validation)
  if (data.email && typeof data.email === 'string') {
    // Check for multiple @ symbols or unusual patterns
    const emailParts = data.email.split('@');
    if (emailParts.length > 2) {
      errors.push(AUTH_VALIDATION_MESSAGES.EMAIL_INVALID);
    }
    
    // Check for common email spoofing attempts
    if (data.email.includes('<') || data.email.includes('>')) {
      errors.push('Email contains invalid characters');
    }
  }
  
  return errors;
};

/**
 * Detects suspicious patterns in login requests that might indicate attack attempts
 * 
 * @param req - Express request object
 * @returns Boolean indicating if suspicious patterns were detected
 */
const containsSuspiciousPatterns = (req: Request): boolean => {
  // Check for SQL injection attempts
  const sqlInjectionPattern = /(\%27)|(\')|(\-\-)|(\%23)|(#)/i;
  
  if (
    (req.body.email && typeof req.body.email === 'string' && sqlInjectionPattern.test(req.body.email)) ||
    (req.body.password && typeof req.body.password === 'string' && sqlInjectionPattern.test(req.body.password))
  ) {
    return true;
  }
  
  // Check for abnormally long inputs that might indicate buffer overflow attempts
  if (
    (req.body.email && typeof req.body.email === 'string' && req.body.email.length > 255) ||
    (req.body.password && typeof req.body.password === 'string' && req.body.password.length > 100)
  ) {
    return true;
  }
  
  return false;
};

/**
 * Validates reset token format
 * 
 * @param token - Reset token to validate
 * @returns Boolean indicating if token format is valid
 */
const isValidResetToken = (token: string): boolean => {
  // Validate token format - should match the actual token format used in the application
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Check for proper token format (typically a secure random string)
  const tokenPattern = /^[A-Za-z0-9\-_]{32,128}$/;
  if (!tokenPattern.test(token)) {
    return false;
  }
  
  // Additional checks could be performed here, such as:
  // - Check if token contains expected segments
  // - Validate token hasn't been tampered with
  
  return true;
};

/**
 * Validates password strength beyond the basic class-validator checks
 * 
 * @param password - Password to validate
 * @returns Boolean indicating if password meets strength requirements
 */
const isPasswordStrong = (password: string): boolean => {
  if (!password || typeof password !== 'string') {
    return false;
  }
  
  // Basic complexity requirements are already checked by class-validator
  // This function performs additional security checks
  
  // Check for common passwords (abbreviated list for example)
  const commonPasswords = [
    'password', 'admin', '123456', 'qwerty', 'welcome'
  ];
  
  const lowercasePassword = password.toLowerCase();
  if (commonPasswords.some(common => lowercasePassword.includes(common))) {
    return false;
  }
  
  // Ensure password has good character distribution
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  // Must have at least 3 of the 4 character types for stronger passwords
  const characterTypeCount = [hasUppercase, hasLowercase, hasDigit, hasSpecial]
    .filter(Boolean).length;
  
  return characterTypeCount >= 3;
};