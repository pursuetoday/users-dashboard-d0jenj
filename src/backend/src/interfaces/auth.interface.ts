/**
 * Authentication Interface Definitions
 * 
 * This file defines the core interfaces for the authentication system,
 * supporting JWT-based authentication with role-based access control.
 * These interfaces provide type safety and standardization for:
 * 
 * - Login credential validation
 * - Authentication token management
 * - Password reset flows
 * - Token refresh operations
 * 
 * The structures align with security best practices for token management,
 * including proper expiration handling and secure credential processing.
 * 
 * @version 1.0.0
 */

import { IUser } from './user.interface';
import { JwtPayload } from './jwt-payload.interface';

/**
 * Interface defining the structure of login credentials
 * Used for validating login request payload
 */
export interface ILoginCredentials {
  /**
   * User's email address for authentication
   * Must be a valid email format
   */
  email: string;
  
  /**
   * User's password for authentication
   * Should meet security requirements defined in validation
   */
  password: string;
}

/**
 * Interface defining the structure of authentication tokens response
 * Includes both access and refresh tokens with expiration tracking
 */
export interface IAuthTokens {
  /**
   * JWT access token used for API authorization
   * Short-lived (15 minutes) as specified in security requirements
   */
  accessToken: string;
  
  /**
   * Refresh token used to obtain new access tokens
   * Longer-lived (7 days) as specified in security requirements
   */
  refreshToken: string;
  
  /**
   * Expiration time in seconds for the access token
   * Allows client to schedule token refresh before expiration
   */
  expiresIn: number;
}

/**
 * Interface defining the structure for password reset
 * Includes the reset token and new password information
 */
export interface IPasswordReset {
  /**
   * User's email address to identify the account
   */
  email: string;
  
  /**
   * One-time reset token received via email
   * Limited validity period (1 hour) as per security requirements
   */
  token: string;
  
  /**
   * New password to replace the existing one
   * Must meet password security requirements
   */
  newPassword: string;
}

/**
 * Interface defining the structure of refresh token request
 * Used for obtaining new access tokens without re-authentication
 */
export interface IRefreshTokenPayload {
  /**
   * Refresh token issued during previous authentication
   * Used to validate the refresh request and issue new tokens
   */
  refreshToken: string;
}