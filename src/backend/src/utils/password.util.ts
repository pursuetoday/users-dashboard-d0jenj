/**
 * Password Utility Functions
 *
 * This module provides utility functions for secure password handling including:
 * - Password hashing using bcrypt with 12 rounds of salt
 * - Password comparison for authentication
 * - Password validation against security requirements
 * - Password validation error message generation
 *
 * The password security requirements enforced are:
 * - Minimum 8 characters in length
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*)
 */

import bcrypt from 'bcrypt'; // v5.1.0
import { AUTH_VALIDATION_MESSAGES } from '../constants/validation-messages';

/**
 * Hashes a plain text password using bcrypt with 12 rounds of salt
 * 
 * @param password - Plain text password to hash
 * @returns Promise resolving to the hashed password string
 * @throws Error if the password is null or undefined
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (!password) {
    throw new Error('Password cannot be empty');
  }
  
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a hashed password
 * 
 * @param plainPassword - Plain text password to compare
 * @param hashedPassword - Hashed password to compare against
 * @returns Promise resolving to true if passwords match, false otherwise
 * @throws Error if either password is null or undefined
 */
export const comparePasswords = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  if (!plainPassword || !hashedPassword) {
    throw new Error('Both passwords must be provided for comparison');
  }
  
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Validates password against security requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*)
 * 
 * @param password - Password to validate
 * @returns True if password meets all requirements, false otherwise
 */
export const validatePassword = (password: string): boolean => {
  if (!password) {
    return false;
  }
  
  // Check minimum length
  if (password.length < 8) {
    return false;
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return false;
  }
  
  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return false;
  }
  
  // Check for at least one special character
  if (!/[!@#$%^&*]/.test(password)) {
    return false;
  }
  
  return true;
};

/**
 * Returns appropriate validation error message for password
 * 
 * @param password - Password to validate
 * @returns Validation error message or null if password is valid
 */
export const getPasswordValidationError = (password: string): string | null => {
  if (!password) {
    return AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED;
  }
  
  if (password.length < 8) {
    return AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH;
  }
  
  // Use validatePassword to check complexity requirements
  // Since we've already checked for length and existence,
  // we need to focus on the other complexity requirements
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*]/.test(password)) {
    return AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY;
  }
  
  return null;
};