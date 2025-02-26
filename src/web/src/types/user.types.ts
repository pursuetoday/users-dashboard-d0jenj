/**
 * User Types for User Management Dashboard
 * @packageDocumentation
 * @version 1.0.0
 */

import type { ApiResponse } from './api.types';

/**
 * Enum defining available user roles in the system
 * Based on the authorization matrix in the technical specifications
 */
export enum UserRole {
  /** Administrator with full system access */
  ADMIN = 'ADMIN',
  /** Manager with user management capabilities */
  MANAGER = 'MANAGER',
  /** Regular user with limited access */
  USER = 'USER',
  /** Guest with read-only access */
  GUEST = 'GUEST'
}

/**
 * Core user interface representing a user in the system
 * Maps to the database schema defined in the technical specifications
 */
export interface User {
  /** Unique identifier for the user (UUID) */
  id: string;
  /** User's email address (unique) */
  email: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's role determining access permissions */
  role: UserRole;
  /** Whether the user account is currently active */
  isActive: boolean;
  /** ISO timestamp of when the user was created */
  createdAt: string;
  /** ISO timestamp of when the user was last updated */
  updatedAt: string;
}

/**
 * Interface for user form data input
 * Used for creating and updating users with validation rules
 * from the technical specifications
 */
export interface UserFormData {
  /** Email address (required, valid format, max 255 chars) */
  email: string;
  /** First name (required, 2-50 chars, alphabets and spaces) */
  firstName: string;
  /** Last name (required, 2-50 chars, alphabets and spaces) */
  lastName: string;
  /** User role (must match predefined roles) */
  role: UserRole;
  /** Account status (active or inactive) */
  isActive: boolean;
}

/**
 * Type for single user API responses
 * Extends the generic ApiResponse with User as the data type
 */
export interface UserResponse extends ApiResponse<User> {
  /** The user data */
  data: User;
  /** Response message */
  message: string;
}

/**
 * Type for paginated users list response
 * Provides a list of users with pagination metadata
 */
export interface UsersResponse {
  /** Array of user objects */
  data: User[];
  /** Total number of users matching the query criteria */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of users per page */
  limit: number;
}

/**
 * Interface for user filtering options
 * Used to filter the users list by various criteria
 */
export interface UserFilters {
  /** Filter by user role (or null for all roles) */
  role: UserRole | null;
  /** Filter by active status (or null for all statuses) */
  isActive: boolean | null;
  /** Text search across user fields (name, email) */
  search: string;
}