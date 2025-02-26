/**
 * JWT Payload Interface Definitions
 * 
 * This file defines the structure of the JWT payload used for authentication tokens,
 * ensuring type safety and standardization of claims across the authentication system.
 * The payload structure supports role-based access control and includes standard
 * JWT claims along with custom application-specific claims.
 * 
 * @version 1.0.0
 */

import { UserRole } from './user.interface';

/**
 * Interface defining the structure of JWT token payload
 * Contains standard JWT claims and application-specific user data
 * for authentication and authorization purposes
 */
export interface JwtPayload {
  /**
   * Subject claim - typically the user ID
   * Uniquely identifies the user for whom the token was issued
   */
  sub: string;
  
  /**
   * User's email address
   * Used for user identification in the authentication system
   */
  email: string;
  
  /**
   * User's role in the system
   * Used for role-based access control (RBAC)
   */
  role: UserRole;
  
  /**
   * Issued at timestamp (in seconds since Unix epoch)
   * Standard JWT claim indicating when the token was issued
   */
  iat: number;
  
  /**
   * Expiration timestamp (in seconds since Unix epoch)
   * Standard JWT claim indicating when the token expires
   */
  exp: number;
}