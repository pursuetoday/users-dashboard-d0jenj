import { IsOptional, IsEmail, IsString, Length, Matches, IsEnum, IsBoolean } from 'class-validator'; // v0.14.0
import { Expose } from 'class-transformer'; // v0.5.1
import { UserRole } from '../../interfaces/user.interface';
import { USER_VALIDATION_MESSAGES, AUTH_VALIDATION_MESSAGES } from '../../constants/validation-messages';
import { ROLES } from '../../constants/roles';

/**
 * Data Transfer Object for updating user information
 * 
 * Implements comprehensive validation and type safety for user update operations
 * with enhanced security measures. All fields are optional since updates
 * may modify only specific fields.
 */
@Expose()
export class UpdateUserDto {
  /**
   * User's email address
   * Must be a valid email format and cannot exceed 255 characters
   */
  @IsOptional()
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  @Length(1, 255, { message: AUTH_VALIDATION_MESSAGES.EMAIL_MAX_LENGTH })
  email?: string;

  /**
   * User's first name
   * Must be between 2-50 characters and contain only letters and spaces
   */
  @IsOptional()
  @IsString()
  @Length(2, 50, { 
    message: (args) => args.constraints[0] === 2 
      ? AUTH_VALIDATION_MESSAGES.FIRST_NAME_MIN_LENGTH 
      : AUTH_VALIDATION_MESSAGES.FIRST_NAME_MAX_LENGTH 
  })
  @Matches(/^[A-Za-z\s]+$/, { message: AUTH_VALIDATION_MESSAGES.FIRST_NAME_ALPHA })
  firstName?: string;

  /**
   * User's last name
   * Must be between 2-50 characters and contain only letters and spaces
   */
  @IsOptional()
  @IsString()
  @Length(2, 50, { 
    message: (args) => args.constraints[0] === 2 
      ? AUTH_VALIDATION_MESSAGES.LAST_NAME_MIN_LENGTH 
      : AUTH_VALIDATION_MESSAGES.LAST_NAME_MAX_LENGTH 
  })
  @Matches(/^[A-Za-z\s]+$/, { message: AUTH_VALIDATION_MESSAGES.LAST_NAME_ALPHA })
  lastName?: string;

  /**
   * User's role in the system
   * Must be one of the predefined roles: ADMIN, MANAGER, USER, GUEST
   */
  @IsOptional()
  @IsEnum(UserRole, { message: USER_VALIDATION_MESSAGES.ROLE_INVALID })
  role?: UserRole;

  /**
   * Whether the user account is active
   * Boolean value indicating if the user can access the system
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}