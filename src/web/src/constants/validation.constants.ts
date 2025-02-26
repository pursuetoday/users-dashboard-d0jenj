/**
 * Validation constants for form validation across the application.
 * Provides strictly typed validation rules and error messages with security measures.
 * 
 * @packageDocumentation
 */

/**
 * Interface for email validation rules
 */
interface EmailValidationRule {
  readonly required: boolean;
  readonly maxLength: number;
  readonly format: string;
  readonly pattern: string;
}

/**
 * Interface for password validation rules
 */
interface PasswordValidationRule {
  readonly required: boolean;
  readonly minLength: number;
  readonly hasUppercase: boolean;
  readonly hasNumber: boolean;
  readonly hasSpecialChar: boolean;
  readonly pattern: string;
}

/**
 * Interface for name validation rules
 */
interface NameValidationRule {
  readonly required: boolean;
  readonly minLength: number;
  readonly maxLength: number;
  readonly format: string;
  readonly pattern: string;
}

/**
 * Interface for role validation rules
 */
interface RoleValidationRule {
  readonly required: boolean;
  readonly validRoles: readonly string[];
  readonly enumType: string;
}

/**
 * Type for all validation rules
 */
type ValidationRule = EmailValidationRule | PasswordValidationRule | NameValidationRule | RoleValidationRule;

/**
 * Validation rules for different form fields with strict typing
 * Used to validate user input across the application
 */
export const VALIDATION_RULES = {
  /**
   * Email validation rules
   * - Required field
   * - Maximum length: 255 characters
   * - Must follow standard email format
   */
  EMAIL: {
    required: true,
    maxLength: 255,
    format: 'email',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
  } as const,

  /**
   * Password validation rules
   * - Required field
   * - Minimum length: 8 characters
   * - Must contain at least one uppercase letter
   * - Must contain at least one number
   * - Must contain at least one special character
   */
  PASSWORD: {
    required: true,
    minLength: 8,
    hasUppercase: true,
    hasNumber: true,
    hasSpecialChar: true,
    pattern: '^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$'
  } as const,

  /**
   * Name validation rules
   * - Required field
   * - Length between 2 and 50 characters
   * - Can only contain alphabets and spaces
   */
  NAME: {
    required: true,
    minLength: 2,
    maxLength: 50,
    format: 'alphabetsAndSpaces',
    pattern: '^[a-zA-Z\\s]{2,50}$'
  } as const,

  /**
   * Role validation rules
   * - Required field
   * - Must be one of the predefined roles: Admin, Manager, User, Guest
   */
  ROLE: {
    required: true,
    validRoles: ['Admin', 'Manager', 'User', 'Guest'] as const,
    enumType: 'UserRole'
  } as const
} as const;

/**
 * Validation error messages for display to users
 * Internationalization-ready validation error messages
 */
export const VALIDATION_MESSAGES = {
  /** General required field message */
  REQUIRED: 'This field is required',
  
  /** Email format error message */
  EMAIL_FORMAT: 'Please enter a valid email address',
  
  /** Email maximum length error message */
  EMAIL_MAX_LENGTH: 'Email must not exceed 255 characters',
  
  /** Password minimum length error message */
  PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters long',
  
  /** Password uppercase requirement error message */
  PASSWORD_UPPERCASE: 'Password must contain at least one uppercase letter',
  
  /** Password number requirement error message */
  PASSWORD_NUMBER: 'Password must contain at least one number',
  
  /** Password special character requirement error message */
  PASSWORD_SPECIAL: 'Password must contain at least one special character',
  
  /** Name length requirement error message */
  NAME_LENGTH: 'Name must be between 2 and 50 characters',
  
  /** Name format requirement error message */
  NAME_FORMAT: 'Name can only contain letters and spaces',
  
  /** Role validation error message */
  ROLE_INVALID: 'Please select a valid role'
} as const;