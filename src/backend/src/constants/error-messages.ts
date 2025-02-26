/**
 * Error Messages
 * 
 * Centralized collection of error message constants used throughout the backend application
 * for consistent error handling and user feedback.
 * 
 * These messages are designed to be secure (not exposing sensitive system information)
 * while still providing meaningful feedback to users.
 */

/**
 * Authentication-related error messages
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'Unauthorized access',
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_INVALID: 'Invalid authentication token',
  TOKEN_MISSING: 'Authentication token is required',
  USER_NOT_FOUND: 'User not found',
  EMAIL_EXISTS: 'Email already registered'
} as const;

/**
 * Input validation error messages
 */
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PASSWORD: 'Password must be at least 8 characters with 1 uppercase, 1 number and 1 special character',
  INVALID_INPUT: 'Invalid input provided',
  INVALID_ROLE: 'Invalid user role'
} as const;

/**
 * Database operation error messages
 */
export const DATABASE_ERRORS = {
  CONNECTION_ERROR: 'Database connection error',
  QUERY_ERROR: 'Database query error',
  RECORD_NOT_FOUND: 'Record not found',
  DUPLICATE_ENTRY: 'Duplicate record exists',
  TRANSACTION_ERROR: 'Transaction failed'
} as const;

/**
 * System-level error messages
 */
export const SYSTEM_ERRORS = {
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  INVALID_CONFIG: 'Invalid system configuration'
} as const;

/**
 * Cache operation error messages
 */
export const CACHE_ERRORS = {
  CACHE_MISS: 'Cache data not found',
  CACHE_ERROR: 'Cache operation failed',
  CACHE_CONNECT_ERROR: 'Failed to connect to cache server'
} as const;