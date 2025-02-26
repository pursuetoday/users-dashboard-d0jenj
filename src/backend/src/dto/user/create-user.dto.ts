import { IsEmail, IsString, IsEnum, MinLength, MaxLength, Matches } from 'class-validator'; // v0.14.0
import { IUser, UserRole } from '../../interfaces/user.interface';
import { AUTH_VALIDATION_MESSAGES } from '../../constants/validation-messages';

/**
 * Data Transfer Object for creating new users
 * 
 * This DTO implements comprehensive validation rules for user creation requests
 * ensuring data integrity, security, and compliance with system requirements.
 * It validates:
 * - Email format and length
 * - Password complexity and security requirements
 * - Name format and length restrictions
 * - Role validity within the system
 */
export class CreateUserDto implements Pick<IUser, 'email' | 'password' | 'firstName' | 'lastName' | 'role'> {
  /**
   * User's email address
   * - Must be a valid email format
   * - Maximum 255 characters
   */
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  @MaxLength(255, { message: AUTH_VALIDATION_MESSAGES.EMAIL_MAX_LENGTH })
  email: string;

  /**
   * User's password
   * - Minimum 8 characters
   * - Must contain uppercase, lowercase, number, and special character
   */
  @IsString({ message: AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED })
  @MinLength(8, { message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, { 
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY 
  })
  password: string;

  /**
   * User's first name
   * - Must be 2-50 characters long
   * - Only alphabetic characters and spaces allowed
   */
  @IsString({ message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_REQUIRED })
  @MinLength(2, { message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_MIN_LENGTH })
  @MaxLength(50, { message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_MAX_LENGTH })
  @Matches(/^[A-Za-z\s]+$/, { message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_ALPHA })
  firstName: string;

  /**
   * User's last name
   * - Must be 2-50 characters long
   * - Only alphabetic characters and spaces allowed
   */
  @IsString({ message: AUTH_VALIDATION_MESSAGES.LAST_NAME_REQUIRED })
  @MinLength(2, { message: AUTH_VALIDATION_MESSAGES.LAST_NAME_MIN_LENGTH })
  @MaxLength(50, { message: AUTH_VALIDATION_MESSAGES.LAST_NAME_MAX_LENGTH })
  @Matches(/^[A-Za-z\s]+$/, { message: AUTH_VALIDATION_MESSAGES.LAST_NAME_ALPHA })
  lastName: string;

  /**
   * User's role in the system
   * - Must be a valid role from the UserRole enum
   */
  @IsEnum(UserRole, { message: USER_VALIDATION_MESSAGES.ROLE_INVALID })
  role: UserRole;
}