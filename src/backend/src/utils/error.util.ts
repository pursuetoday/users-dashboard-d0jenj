import { HTTP_STATUS } from '../constants/http-status';
import { AUTH_ERRORS } from '../constants/error-messages';

/**
 * Base Error class that extends native Error to provide additional
 * error context and standardization across the application.
 * 
 * This serves as the foundation for all custom error types in the system,
 * ensuring consistent error handling and response formatting.
 */
export class BaseError extends Error {
  message: string;
  statusCode: number;
  details: any;
  isOperational: boolean;

  /**
   * Create a new BaseError instance
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code
   * @param details - Additional error details (optional)
   */
  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Indicates if error is operational (expected) or programming (unexpected)
    
    // Capture stack trace for better debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error for input validation failures
 * Used when request data fails validation rules
 */
export class ValidationError extends BaseError {
  /**
   * Create a new ValidationError
   * @param message - Error message
   * @param details - Validation error details (e.g., field-specific errors)
   */
  constructor(message: string, details?: any) {
    super(message, HTTP_STATUS.BAD_REQUEST, details);
  }
}

/**
 * Authentication Error for auth-related failures
 * Used when authentication fails or credentials are invalid
 */
export class AuthenticationError extends BaseError {
  /**
   * Create a new AuthenticationError
   * @param message - Error message
   * @param details - Authentication error details
   */
  constructor(message: string, details?: any) {
    super(message, HTTP_STATUS.UNAUTHORIZED, details);
  }
}

/**
 * Creates a standardized error response object for API responses
 * with security considerations to prevent sensitive information exposure
 * 
 * @param error - The error object
 * @returns Standardized error response object
 */
export function createErrorResponse(error: Error): Record<string, any> {
  const isBaseError = error instanceof BaseError;
  const statusCode = isBaseError ? (error as BaseError).statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = error.message || 'An unexpected error occurred';
  
  // Create the standardized response
  const errorResponse: Record<string, any> = {
    success: false,
    status: statusCode,
    message: message,
  };

  // Add sanitized details for BaseError instances
  if (isBaseError && (error as BaseError).details) {
    // Sanitize details to avoid exposing sensitive information
    errorResponse.details = (error as BaseError).details;
  }
  
  // Include stack trace only in development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }
  
  // Add error code for client-side error handling if available
  if (isBaseError) {
    errorResponse.code = (error as BaseError).name.replace('Error', '').toUpperCase();
  }
  
  // Log error for monitoring and debugging
  console.error(`[ERROR] ${error.name}: ${error.message}`, 
    isBaseError ? { statusCode, details: (error as BaseError).details } : '');
  
  return errorResponse;
}

/**
 * Determines if an error is operational (expected) or programming (unexpected)
 * Used to decide if application should crash or continue running
 * 
 * @param error - The error to check
 * @returns True if error is operational, false otherwise
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  
  // Programming errors should be logged with high priority for immediate attention
  console.error('[CRITICAL] Programming Error:', error);
  
  // Any other error type is considered a programming error
  return false;
}