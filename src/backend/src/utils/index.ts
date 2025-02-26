/**
 * Central Utility Module
 * 
 * This module aggregates and re-exports all utility functions, classes, and constants
 * from the utils directory, providing a unified access point for core utilities while
 * maintaining proper encapsulation and enabling efficient tree-shaking.
 * 
 * @module utils
 * @version 1.0.0
 */

// Cryptographic utilities
import { encrypt, decrypt, hash } from './encryption.util';

// Error handling utilities
import { 
  BaseError, 
  ValidationError,
  AuthenticationError,
  createErrorResponse,
  isOperationalError
} from './error.util';

// JWT token management utilities
import {
  generateToken,
  verifyToken,
  decodeToken
} from './jwt.util';

// Logging utilities
import { logger } from './logger.util';

// Password management utilities
import {
  hashPassword,
  comparePasswords,
  validatePassword as isPasswordValid,
  getPasswordValidationError
} from './password.util';

// Input validation utilities
import {
  validateEmail,
  validatePassword as assessPasswordStrength,
  validateName,
  validateRole,
  sanitizeInput
} from './validation.util';

// Re-export cryptographic functions for secure data handling
export { encrypt, decrypt, hash };

// Re-export error handling utilities
export { 
  BaseError, 
  ValidationError,
  AuthenticationError,
  createErrorResponse,
  isOperationalError
};

// Re-export JWT token management utilities
export {
  generateToken,
  verifyToken,
  decodeToken
};

// Re-export logging utilities
export { logger };

// Re-export input validation utilities
export {
  validateEmail,
  validateName,
  validateRole,
  sanitizeInput
};

// Re-export password management utilities with clear naming to avoid conflicts
export {
  hashPassword,
  comparePasswords,
  getPasswordValidationError,
  // The basic boolean password validation function
  isPasswordValid,
  // The comprehensive password validation with strength assessment
  assessPasswordStrength
};