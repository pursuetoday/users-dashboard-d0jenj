/**
 * Express Request Type Augmentation
 * 
 * This declaration file extends Express's Request interface to include
 * custom properties for authenticated requests, providing strong typing
 * for request handlers that work with authenticated users.
 * 
 * It addresses the security requirements in the technical specification by
 * ensuring type safety for JWT-based authentication and role-based access control.
 * 
 * @version 1.0.0
 */

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { IUser } from '../interfaces/user.interface';

// Extend Express Request interface to include authentication properties
declare namespace Express {
  interface Request {
    /**
     * Authenticated user data
     * Available after authentication middleware processes the request
     */
    user?: IUser;

    /**
     * Raw JWT token string
     * Available after authentication middleware processes the request
     */
    token?: string;

    /**
     * Decoded JWT payload
     * Available after authentication middleware processes the request
     */
    jwtPayload?: JwtPayload;
  }
}

/**
 * Type-safe interface for authenticated requests
 * Ensures the request has the necessary authentication properties
 * by making the optional properties required
 */
export interface AuthenticatedRequest extends Express.Request {
  /**
   * Authenticated user data (required in this interface)
   */
  user: IUser;
  
  /**
   * Raw JWT token string (required in this interface)
   */
  token: string;
  
  /**
   * Decoded JWT payload (required in this interface)
   */
  jwtPayload: JwtPayload;
}