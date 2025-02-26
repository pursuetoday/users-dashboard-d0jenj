/**
 * Authentication Validation Schemas
 * 
 * This file defines comprehensive Yup validation schemas for authentication-related forms
 * with enhanced security measures, strict validation patterns, and detailed error messaging
 * for login, registration, and password reset flows.
 * 
 * @packageDocumentation
 */

import { object, string } from 'yup'; // yup v1.0.0
import { 
  LoginCredentials, 
  RegisterData, 
  ResetPasswordData 
} from '../types/auth.types';
import { 
  VALIDATION_RULES, 
  VALIDATION_MESSAGES 
} from '../constants/validation.constants';

/**
 * Creates a comprehensive Yup validation schema for email fields
 * with enhanced security patterns and accessibility-friendly error messages
 * 
 * @returns Configured email validation schema with strict format checking
 */
const createEmailValidation = () => {
  return string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .email(VALIDATION_MESSAGES.EMAIL_FORMAT)
    .max(VALIDATION_RULES.EMAIL.maxLength, VALIDATION_MESSAGES.EMAIL_MAX_LENGTH)
    .matches(
      new RegExp(VALIDATION_RULES.EMAIL.pattern),
      VALIDATION_MESSAGES.EMAIL_FORMAT
    )
    // Apply sanitization
    .transform(value => 
      value ? value.trim().toLowerCase() : value
    )
    .strict();
};

/**
 * Creates a robust Yup validation schema for password fields
 * with enhanced security requirements and clear error messaging
 * 
 * @returns Configured password validation schema with complexity requirements
 */
const createPasswordValidation = () => {
  return string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .min(VALIDATION_RULES.PASSWORD.minLength, VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH)
    .matches(/[A-Z]/, VALIDATION_MESSAGES.PASSWORD_UPPERCASE)
    .matches(/[0-9]/, VALIDATION_MESSAGES.PASSWORD_NUMBER)
    .matches(/[!@#$%^&*]/, VALIDATION_MESSAGES.PASSWORD_SPECIAL)
    .max(100, 'Password must not exceed 100 characters')
    .matches(
      new RegExp(VALIDATION_RULES.PASSWORD.pattern),
      'Password must include at least 1 uppercase letter, 1 number, and 1 special character'
    )
    .strict();
};

/**
 * Creates a Yup validation schema for name fields
 * with proper length restrictions and character validation
 * 
 * @returns Configured name validation schema with format restrictions
 */
const createNameValidation = () => {
  return string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .min(VALIDATION_RULES.NAME.minLength, VALIDATION_MESSAGES.NAME_LENGTH)
    .max(VALIDATION_RULES.NAME.maxLength, VALIDATION_MESSAGES.NAME_LENGTH)
    .matches(
      new RegExp(VALIDATION_RULES.NAME.pattern),
      VALIDATION_MESSAGES.NAME_FORMAT
    )
    // Apply sanitization
    .transform(value => 
      value ? value.trim().replace(/[^a-zA-Z\s]/g, '') : value // Keep only letters and spaces
    )
    .strict();
};

/**
 * Validation schema for login form with enhanced security measures
 * Validates the LoginCredentials interface fields
 */
export const loginSchema = object<LoginCredentials>({
  email: createEmailValidation(),
  password: createPasswordValidation()
});

/**
 * Comprehensive validation schema for registration form with strict validation rules
 * Validates the RegisterData interface fields
 */
export const registerSchema = object<RegisterData>({
  email: createEmailValidation(),
  password: createPasswordValidation(),
  firstName: createNameValidation(),
  lastName: createNameValidation()
});

/**
 * Validation schema for password reset form with email validation
 * Validates the ResetPasswordData interface fields
 */
export const resetPasswordSchema = object<ResetPasswordData>({
  email: createEmailValidation()
});