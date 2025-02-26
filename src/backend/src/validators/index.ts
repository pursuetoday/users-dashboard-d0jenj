/**
 * Validators Index Module
 * 
 * Centralizes and exports all validation middleware functions for authentication and user 
 * management operations. This module serves as the single source of truth for API input 
 * validation across the application, implementing comprehensive security measures to prevent 
 * common attack vectors like XSS, SQL injection, and malicious input.
 * 
 * The validation middleware implements:
 * - Strict input validation with detailed error messages
 * - Input sanitization to prevent injection attacks
 * - Role-based validation hierarchy for authorization
 * - XSS prevention through content filtering
 * - Format verification for emails, passwords, and other fields
 * 
 * @version 1.0.0
 */

// Authentication validators - implements validation for login, registration, and password reset flows
import { 
  validateLoginRequest,
  validateRegisterRequest,
  validateResetPasswordRequest
} from './auth.validator';

// User management validators - implements validation for user CRUD operations with security measures
import {
  validateCreateUser,
  validateUpdateUser,
  validateUserQueryParams
} from './user.validator';

/**
 * Authentication Validators
 * 
 * These validators implement the security requirements specified in the form validation rules
 * from section 3.1 of the technical specification, ensuring all authentication-related
 * inputs meet security standards with appropriate error messaging.
 */
export {
  /**
   * Validates login request data including email and password with security best practices
   * to prevent information disclosure and protect against common attack vectors.
   */
  validateLoginRequest,

  /**
   * Validates user registration data with comprehensive field validation including email format,
   * password complexity, and name format requirements, along with XSS prevention.
   */
  validateRegisterRequest,

  /**
   * Validates password reset requests with token verification and password strength checks
   * to ensure secure password management.
   */
  validateResetPasswordRequest
};

/**
 * User Management Validators
 * 
 * These validators ensure data integrity and security for all user management operations
 * according to the data sanitization requirements in section 7.2 of the technical specification,
 * implementing role-based permissions and field-level validation.
 */
export {
  /**
   * Validates user creation data with role-based validation rules and field sanitization,
   * ensuring all required fields meet format and security requirements.
   */
  validateCreateUser,

  /**
   * Validates user update operations with field-level validation and permission checks
   * to prevent privilege escalation and ensure data integrity.
   */
  validateUpdateUser,
  
  /**
   * Validates user query parameters for listing and filtering operations with sanitization
   * to prevent injection attacks and ensure performance through pagination limits.
   */
  validateUserQueryParams
};