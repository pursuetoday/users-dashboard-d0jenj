/**
 * User Interface Definitions
 * 
 * This file defines the core data structures for the user management system,
 * ensuring type safety and consistent user data representation across the application.
 * 
 * It provides:
 * - Role type definitions: Enum mapping to available roles
 * - Base user interface: Complete internal user data structure
 * - Response interface: External user representation (excludes sensitive data)
 * - Operation-specific interfaces: For create and update operations
 * 
 * @version 1.0.0
 */

import { ROLES } from '../constants/roles';

/**
 * User roles supported in the application
 * Maps to the role constants defined in the RBAC system
 */
export enum UserRole {
  ADMIN = ROLES.ADMIN,
  MANAGER = ROLES.MANAGER,
  USER = ROLES.USER,
  GUEST = ROLES.GUEST
}

/**
 * Core user interface defining the complete user data structure
 * used internally within the system
 */
export interface IUser {
  /**
   * Unique identifier for the user
   */
  id: string;
  
  /**
   * User's email address (used for authentication)
   */
  email: string;
  
  /**
   * Hashed password (sensitive field)
   */
  password: string;
  
  /**
   * User's first name
   */
  firstName: string;
  
  /**
   * User's last name
   */
  lastName: string;
  
  /**
   * User's role in the system, determining permissions
   */
  role: UserRole;
  
  /**
   * Whether the user account is active
   */
  isActive: boolean;
  
  /**
   * Timestamp when the user record was created
   */
  createdAt: Date;
  
  /**
   * Timestamp when the user record was last updated
   */
  updatedAt: Date;
}

/**
 * User interface for API responses
 * Excludes sensitive fields like password
 * and formats dates as strings for JSON serialization
 */
export interface IUserResponse {
  /**
   * Unique identifier for the user
   */
  id: string;
  
  /**
   * User's email address
   */
  email: string;
  
  /**
   * User's first name
   */
  firstName: string;
  
  /**
   * User's last name
   */
  lastName: string;
  
  /**
   * User's role in the system
   */
  role: UserRole;
  
  /**
   * Whether the user account is active
   */
  isActive: boolean;
  
  /**
   * Timestamp when the user record was created (ISO string format)
   */
  createdAt: string;
  
  /**
   * Timestamp when the user record was last updated (ISO string format)
   */
  updatedAt: string;
}

/**
 * Interface for user creation operations
 * Includes only the fields required to create a new user
 */
export interface IUserCreate {
  /**
   * User's email address (required for authentication)
   */
  email: string;
  
  /**
   * User's password (will be hashed before storage)
   */
  password: string;
  
  /**
   * User's first name
   */
  firstName: string;
  
  /**
   * User's last name
   */
  lastName: string;
  
  /**
   * User's role in the system
   */
  role: UserRole;
}

/**
 * Interface for user update operations
 * All fields are optional since updates may modify only specific fields
 */
export interface IUserUpdate {
  /**
   * User's email address (optional)
   */
  email?: string;
  
  /**
   * User's first name (optional)
   */
  firstName?: string;
  
  /**
   * User's last name (optional)
   */
  lastName?: string;
  
  /**
   * User's role in the system (optional)
   */
  role?: UserRole;
  
  /**
   * Whether the user account is active (optional)
   */
  isActive?: boolean;
}