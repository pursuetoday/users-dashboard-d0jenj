/**
 * User schema validation module
 * Defines Yup validation schemas for user-related forms and data validation
 * with enhanced security measures and comprehensive validation rules.
 * 
 * @packageDocumentation
 */

import { object, string, boolean } from 'yup'; // ^1.0.0
import { UserRole } from '../types/user.types';
import { VALIDATION_RULES, VALIDATION_MESSAGES } from '../constants/validation.constants';

// Security-focused regex patterns
// Email validation regex - based on validation constants
const EMAIL_REGEX = new RegExp(VALIDATION_RULES.EMAIL.pattern.replace('\\\\', '\\'));

// Name validation regex - based on validation constants
const NAME_REGEX = new RegExp(VALIDATION_RULES.NAME.pattern.replace('\\\\', '\\'));

// Safe string regex for preventing XSS and injection attacks
const SAFE_STRING_REGEX = /^[a-zA-Z0-9\s.,\-_@()]+$/;

/**
 * Yup validation schema for user form data with enhanced security measures
 * Implements the form validation rules from the technical specifications
 */
export const userSchema = object().shape({
  // Email validation with strict format checking and length limits
  email: string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .email(VALIDATION_MESSAGES.EMAIL_FORMAT)
    .max(VALIDATION_RULES.EMAIL.maxLength, VALIDATION_MESSAGES.EMAIL_MAX_LENGTH)
    .matches(EMAIL_REGEX, VALIDATION_MESSAGES.EMAIL_FORMAT),
  
  // First name validation with length restrictions and format checking
  firstName: string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .min(VALIDATION_RULES.NAME.minLength, VALIDATION_MESSAGES.NAME_LENGTH)
    .max(VALIDATION_RULES.NAME.maxLength, VALIDATION_MESSAGES.NAME_LENGTH)
    .matches(NAME_REGEX, VALIDATION_MESSAGES.NAME_FORMAT),
  
  // Last name validation with length restrictions and format checking
  lastName: string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .min(VALIDATION_RULES.NAME.minLength, VALIDATION_MESSAGES.NAME_LENGTH)
    .max(VALIDATION_RULES.NAME.maxLength, VALIDATION_MESSAGES.NAME_LENGTH)
    .matches(NAME_REGEX, VALIDATION_MESSAGES.NAME_FORMAT),
  
  // Role validation ensuring only valid system roles are used
  role: string()
    .required(VALIDATION_MESSAGES.REQUIRED)
    .oneOf(Object.values(UserRole), VALIDATION_MESSAGES.ROLE_INVALID),
  
  // Active status validation
  isActive: boolean()
    .required(VALIDATION_MESSAGES.REQUIRED)
});

/**
 * Yup validation schema for user filter form with input sanitization
 * Provides validation for search and filter parameters with security measures
 */
export const userFilterSchema = object().shape({
  // Role filter allowing null for "all roles"
  role: string()
    .nullable()
    .oneOf([...Object.values(UserRole), null], VALIDATION_MESSAGES.ROLE_INVALID),
  
  // Active status filter allowing null for "all statuses"
  isActive: boolean()
    .nullable(),
  
  // Search text sanitization to prevent injection attacks
  search: string()
    .nullable()
    .max(100, 'Search string is too long')
    .matches(SAFE_STRING_REGEX, 'Search contains invalid characters')
});