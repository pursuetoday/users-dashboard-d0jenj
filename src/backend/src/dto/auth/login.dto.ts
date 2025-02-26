import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator'; // v0.14.0
import { ILoginCredentials } from '../../interfaces/auth.interface';
import { AUTH_VALIDATION_MESSAGES } from '../../constants/validation-messages';

/**
 * Data Transfer Object for user login credentials validation and transformation
 * with comprehensive security checks for authentication requests.
 * 
 * Implements validation rules for email and password as specified in the form validation
 * requirements, providing standardized error messages and ensuring all inputs
 * meet security requirements before processing.
 * 
 * @implements {ILoginCredentials}
 */
export class LoginDto implements ILoginCredentials {
  /**
   * User's email address for authentication
   * 
   * Validated for:
   * - Required field
   * - Valid email format
   * - Maximum length (255 characters)
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED })
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  @IsString()
  @MaxLength(255, { message: AUTH_VALIDATION_MESSAGES.EMAIL_MAX_LENGTH })
  email: string;

  /**
   * User's password for authentication
   * 
   * Validated for:
   * - Required field
   * - Minimum length (8 characters)
   * - Complexity requirements (uppercase, number, special character)
   */
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @IsString()
  @MinLength(8, { message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, { 
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY 
  })
  password: string;
}