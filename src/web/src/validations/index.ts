/**
 * Centralized Validation Schemas
 * 
 * This module centralizes and exports all validation schemas used throughout the application,
 * providing a single import source for form validations and ensuring consistent
 * input validation across the entire frontend.
 * 
 * The validation schemas implement security best practices including:
 * - Strict input format validation
 * - Data sanitization to prevent XSS attacks
 * - Comprehensive field-level validation
 * - Clear error messaging for accessibility
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// Import authentication validation schemas
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from './auth.schema';

// Import user management validation schemas
import {
  userSchema,
  userFilterSchema
} from './user.schema';

/**
 * Re-export all validation schemas for use throughout the application
 * 
 * Having a centralized export point simplifies imports in components
 * and ensures validation consistency across the application.
 */
export {
  // Authentication schemas for login, registration and password reset
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  
  // User management schemas for user data and filtering
  userSchema,
  userFilterSchema
};