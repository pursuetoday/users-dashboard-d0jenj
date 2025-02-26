/**
 * Central Type Definitions Index
 * 
 * This file serves as the central export point for all TypeScript type definitions
 * used throughout the backend application. It provides comprehensive type safety for
 * authentication, user management, environment configuration, and other core system components.
 * 
 * @version 1.0.0
 */

// Import types from internal files
import { AuthenticatedRequest } from './express';
import { IUser, UserRole, IUserResponse, IUserCreate, IUserUpdate } from '../interfaces/user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ROLES, RoleType, ROLE_HIERARCHY, PERMISSION_TYPES, PermissionType } from '../constants/roles';

/**
 * Type-safe environment variable definitions
 * Based on the NodeJS.ProcessEnv interface extended in environment.d.ts
 */
export interface ProcessEnv {
  /**
   * Application environment mode
   */
  NODE_ENV: 'development' | 'production' | 'test';
  
  /**
   * Secret key for JWT token generation and validation
   */
  JWT_SECRET: string;
  
  /**
   * Server port number
   */
  PORT: number;
}

/**
 * Re-export authenticated request interface to provide
 * type safety for express request handlers with authentication data
 */
export { AuthenticatedRequest };

/**
 * Re-export user role enum for access control throughout the application
 */
export { UserRole };

/**
 * Re-export user interface for consistent user data structure
 */
export { IUser };

/**
 * Re-export JWT payload interface for authentication tokens
 */
export { JwtPayload };

/**
 * Re-export additional user-related interfaces
 */
export { IUserResponse, IUserCreate, IUserUpdate };

/**
 * Re-export role and permission types for authorization
 */
export { ROLES, RoleType, ROLE_HIERARCHY, PERMISSION_TYPES, PermissionType };

/**
 * Type alias for JWT payload with userId property
 * Provides compatibility with systems expecting userId instead of standard sub claim
 */
export type JwtPayloadWithUserId = Omit<JwtPayload, 'sub'> & { 
  /**
   * User identifier (alias for sub claim)
   */
  userId: string 
};

/**
 * Service response interface for standardized API responses
 */
export interface ServiceResponse<T> {
  /**
   * Success status of the operation
   */
  success: boolean;
  
  /**
   * Response data (present on successful operations)
   */
  data?: T;
  
  /**
   * Error message (present on failed operations)
   */
  error?: string;
  
  /**
   * Status code (HTTP status or custom status code)
   */
  statusCode: number;
}

/**
 * Pagination parameters for database queries
 */
export interface PaginationParams {
  /**
   * Current page number (1-based indexing)
   */
  page: number;
  
  /**
   * Number of items per page
   */
  limit: number;
  
  /**
   * Optional sorting field
   */
  sortBy?: string;
  
  /**
   * Sort direction (asc or desc)
   */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Paginated response containing items and pagination metadata
 */
export interface PaginatedResponse<T> {
  /**
   * Array of items for the current page
   */
  items: T[];
  
  /**
   * Total count of all available items
   */
  total: number;
  
  /**
   * Current page number
   */
  page: number;
  
  /**
   * Number of items per page
   */
  limit: number;
  
  /**
   * Total number of pages
   */
  totalPages: number;
  
  /**
   * Whether there is a next page available
   */
  hasNextPage: boolean;
  
  /**
   * Whether there is a previous page available
   */
  hasPrevPage: boolean;
}

/**
 * Filter parameters for database queries
 */
export interface FilterParams {
  /**
   * Key-value pairs for filtering
   */
  [key: string]: any;
}

/**
 * Audit log entry structure for tracking user actions
 */
export interface AuditLogEntry {
  /**
   * User who performed the action
   */
  userId: string;
  
  /**
   * Action performed
   */
  action: string;
  
  /**
   * Resource affected
   */
  resource: string;
  
  /**
   * Resource identifier
   */
  resourceId?: string;
  
  /**
   * Changes made (before/after)
   */
  changes?: Record<string, { before: any; after: any }>;
  
  /**
   * Timestamp of the action
   */
  timestamp: Date;
}