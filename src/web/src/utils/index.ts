/**
 * Centralized utilities module for the User Management Dashboard
 * 
 * This file aggregates and re-exports utility functions from across the application,
 * providing a single entry point for importing utilities while maintaining
 * tree-shaking capabilities through named exports.
 * 
 * Usage:
 * ```typescript
 * // Import individual utilities as needed
 * import { formatDate, validateEmail } from '../utils';
 * 
 * // This ensures only the functions you import are included in your bundle
 * const formattedDate = formatDate('2023-10-15', 'MMM d, yyyy');
 * const isEmailValid = await validateEmail('user@example.com');
 * ```
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// Import all utility functions using namespace imports
import * as ApiUtils from './api.utils';
import * as AuthUtils from './auth.utils';
import * as DateUtils from './date.utils';
import * as ValidationUtils from './validation.utils';
import * as StorageUtils from './storage.utils';

// API Utilities

/**
 * Transforms API responses to standardized format with proper type inference.
 */
export const transformResponse = ApiUtils.transformResponse;

/**
 * Transforms API errors to standardized error format with type safety.
 */
export const transformError = ApiUtils.transformError;

/**
 * Creates type-safe request interceptor for API calls.
 */
export const createRequestInterceptor = ApiUtils.createRequestInterceptor;

/**
 * Creates type-safe response interceptor for API calls.
 */
export const createResponseInterceptor = ApiUtils.createResponseInterceptor;

// Authentication Utilities

/**
 * Retrieves JWT access token with type safety.
 */
export const getAccessToken = AuthUtils.getAccessToken;

/**
 * Retrieves JWT refresh token with type safety.
 */
export const getRefreshToken = AuthUtils.getRefreshToken;

/**
 * Stores authentication tokens with proper type validation.
 */
export const setTokens = AuthUtils.setTokens;

/**
 * Removes authentication tokens with type safety.
 */
export const removeTokens = AuthUtils.removeTokens;

// Date Utilities

/**
 * Formats dates with custom patterns and type validation.
 */
export const formatDate = DateUtils.formatDate;

/**
 * Formats dates with time and proper type checking.
 */
export const formatDateTime = DateUtils.formatDateTime;

/**
 * Formats dates in short format with type safety.
 */
export const formatDateShort = DateUtils.formatDateShort;

// Validation Utilities

/**
 * Validates form field values with proper type checking.
 */
export const validateField = ValidationUtils.validateField;

/**
 * Validates email format with type safety.
 */
export const validateEmail = ValidationUtils.validateEmail;

/**
 * Validates password requirements with type checking.
 */
export const validatePassword = ValidationUtils.validatePassword;

// Storage Utilities

/**
 * Type-safe browser storage type enumeration.
 */
export const StorageType = StorageUtils.StorageType;

/**
 * Stores data in browser storage with type validation.
 */
export const setItem = StorageUtils.setItem;

/**
 * Retrieves data from browser storage with type safety.
 */
export const getItem = StorageUtils.getItem;

/**
 * Removes data from browser storage with type checking.
 */
export const removeItem = StorageUtils.removeItem;