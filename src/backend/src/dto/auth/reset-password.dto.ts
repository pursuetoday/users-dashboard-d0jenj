import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { IPasswordReset } from '../../interfaces/auth.interface';
import { AUTH_VALIDATION_MESSAGES } from '../../constants/validation-messages';

/**
 * Data Transfer Object for password reset requests
 * 
 * Implements comprehensive validation for password reset operations with
 * OWASP-compliant password strength requirements and secure handling
 * of reset tokens.
 */
export class ResetPasswordDto implements IPasswordReset {
  /**
   * User's email address to identify the account for password reset
   * Validated for required presence and proper email format
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED })
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  email: string;

  /**
   * One-time reset token received via email
   * Validated for required presence to ensure security
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.TOKEN_REQUIRED })
  @IsString()
  token: string;

  /**
   * New password to replace the existing one
   * Validated for:
   * - Required presence
   * - Minimum length of 8 characters
   * - Complexity requirements (uppercase, number, special character)
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @IsString()
  @MinLength(8, { message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, { 
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY 
  })
  newPassword: string;
}