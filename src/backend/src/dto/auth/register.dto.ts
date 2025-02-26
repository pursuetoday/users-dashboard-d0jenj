/**
 * Registration Data Transfer Object (DTO)
 * 
 * Implements comprehensive validation rules, type safety, and security measures
 * for user registration data processing according to the technical specifications.
 * This DTO validates email, password, and name fields with strict validation rules.
 * 
 * @version 1.0.0
 */

import { 
  IsEmail, 
  IsNotEmpty, 
  IsString, 
  MinLength, 
  MaxLength, 
  Matches 
} from 'class-validator'; // ^0.14.0

import { AUTH_VALIDATION_MESSAGES } from '../../constants/validation-messages';

/**
 * RegisterDto class
 * 
 * Defines the data structure for user registration requests with comprehensive
 * validation rules for each field according to security requirements.
 * All validations include appropriate error messages for better user experience.
 */
export class RegisterDto {
  /**
   * User's email address
   * - Required field
   * - Must be a valid email format
   * - Maximum length of 255 characters
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED })
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  @MaxLength(255, { message: AUTH_VALIDATION_MESSAGES.EMAIL_MAX_LENGTH })
  email: string;

  /**
   * User's password
   * - Required field
   * - Minimum length of 8 characters
   * - Must contain at least 1 uppercase letter, 1 number, and 1 special character
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @MinLength(8, { message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH })
  @Matches(
    /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
    { message: AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY }
  )
  password: string;

  /**
   * User's first name
   * - Required field
   * - Must be a string
   * - Minimum length of 2 characters
   * - Maximum length of 50 characters
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_REQUIRED })
  @IsString()
  @MinLength(2, { message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_MIN_LENGTH })
  @MaxLength(50, { message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_MAX_LENGTH })
  firstName: string;

  /**
   * User's last name
   * - Required field
   * - Must be a string
   * - Minimum length of 2 characters
   * - Maximum length of 50 characters
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.LAST_NAME_REQUIRED })
  @IsString()
  @MinLength(2, { message: AUTH_VALIDATION_MESSAGES.LAST_NAME_MIN_LENGTH })
  @MaxLength(50, { message: AUTH_VALIDATION_MESSAGES.LAST_NAME_MAX_LENGTH })
  lastName: string;
}