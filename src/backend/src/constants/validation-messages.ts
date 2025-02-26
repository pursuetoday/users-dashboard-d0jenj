/**
 * Validation Messages Constants
 *
 * This file provides centralized validation message constants for form validations,
 * API request validations, and data validations across the application.
 * Messages are categorized into authentication, user management, and query parameters.
 *
 * These constants ensure consistent error messaging and allow for easy updates
 * to validation messages throughout the application.
 */

/**
 * Authentication validation messages
 *
 * Contains validation messages for email, password, user names,
 * and authentication token-related validations.
 */
export const AUTH_VALIDATION_MESSAGES = {
  // Email validation messages
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Please enter a valid email address',
  EMAIL_MAX_LENGTH: 'Email cannot exceed 255 characters',
  
  // Password validation messages
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters long',
  PASSWORD_UPPERCASE: 'Password must contain at least 1 uppercase letter',
  PASSWORD_NUMBER: 'Password must contain at least 1 number',
  PASSWORD_SPECIAL: 'Password must contain at least 1 special character',
  PASSWORD_COMPLEXITY: 'Password must contain at least 1 uppercase letter, 1 number, and 1 special character',
  
  // Name validation messages
  FIRST_NAME_REQUIRED: 'First name is required',
  FIRST_NAME_MIN_LENGTH: 'First name must be at least 2 characters',
  FIRST_NAME_MAX_LENGTH: 'First name cannot exceed 50 characters',
  FIRST_NAME_ALPHA: 'First name can only contain letters and spaces',
  LAST_NAME_REQUIRED: 'Last name is required',
  LAST_NAME_MIN_LENGTH: 'Last name must be at least 2 characters',
  LAST_NAME_MAX_LENGTH: 'Last name cannot exceed 50 characters',
  LAST_NAME_ALPHA: 'Last name can only contain letters and spaces',
  
  // Token validation messages
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_INVALID: 'Invalid authentication token',
  TOKEN_MISSING: 'Authentication token is required'
} as const;

/**
 * User validation messages
 *
 * Contains validation messages for user-specific operations,
 * roles, status, and permissions.
 */
export const USER_VALIDATION_MESSAGES = {
  // Role validation messages
  ROLE_REQUIRED: 'Role is required',
  ROLE_INVALID: 'Invalid role selection',
  ROLE_UNAUTHORIZED: 'Unauthorized role assignment',
  
  // Status validation messages
  STATUS_REQUIRED: 'Status is required',
  STATUS_INVALID: 'Invalid status selection',
  
  // User ID validation messages
  ID_REQUIRED: 'User ID is required',
  ID_INVALID: 'Invalid user ID format',
  ID_NOT_FOUND: 'User ID not found',
  
  // User operation messages
  DUPLICATE_EMAIL: 'Email address already exists',
  UPDATE_UNAUTHORIZED: 'Unauthorized to update user',
  DELETE_UNAUTHORIZED: 'Unauthorized to delete user',
  SELF_DELETE_FORBIDDEN: 'Cannot delete own account',
  ADMIN_DELETE_FORBIDDEN: 'Cannot delete last admin account'
} as const;

/**
 * Query parameter validation messages
 *
 * Contains validation messages for pagination, sorting,
 * filtering, and search parameters.
 */
export const QUERY_VALIDATION_MESSAGES = {
  // Pagination validation messages
  PAGE_NUMBER_REQUIRED: 'Page number is required',
  PAGE_NUMBER_INVALID: 'Page number must be a positive integer',
  PAGE_SIZE_REQUIRED: 'Page size is required',
  PAGE_SIZE_MIN: 'Page size must be at least 1',
  PAGE_SIZE_MAX: 'Page size cannot exceed 100',
  
  // Sorting validation messages
  SORT_FIELD_INVALID: 'Invalid sort field',
  SORT_ORDER_INVALID: "Sort order must be either 'asc' or 'desc'",
  
  // Filter and search validation messages
  FILTER_INVALID: 'Invalid filter parameter',
  SEARCH_TERM_MAX_LENGTH: 'Search term cannot exceed 100 characters',
  DATE_RANGE_INVALID: 'Invalid date range',
  LIMIT_EXCEEDED: 'Query limit exceeded'
} as const;

// Type definitions for validation messages to ensure type safety
export type AuthValidationMessage = typeof AUTH_VALIDATION_MESSAGES[keyof typeof AUTH_VALIDATION_MESSAGES];
export type UserValidationMessage = typeof USER_VALIDATION_MESSAGES[keyof typeof USER_VALIDATION_MESSAGES];
export type QueryValidationMessage = typeof QUERY_VALIDATION_MESSAGES[keyof typeof QUERY_VALIDATION_MESSAGES];