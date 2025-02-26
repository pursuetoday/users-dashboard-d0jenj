/**
 * DTO Barrel File
 * 
 * This barrel file exports all Data Transfer Objects (DTOs) used for request validation
 * and data transformation in the user management system. DTOs implement comprehensive
 * validation rules and type safety for all user operations including authentication,
 * user management, and data processing.
 * 
 * Using these DTOs ensures:
 * - Consistent data validation across the application
 * - Type safety for request handling
 * - Standardized error messages for validation failures
 * - Security through proper input validation
 * 
 * @module dto
 * @version 1.0.0
 */

// Authentication DTOs
export { LoginDto } from './auth/login.dto';
export { RegisterDto } from './auth/register.dto';
export { ResetPasswordDto } from './auth/reset-password.dto';

// User Management DTOs
export { CreateUserDto } from './user/create-user.dto';
export { UpdateUserDto } from './user/update-user.dto';