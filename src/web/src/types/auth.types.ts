/**
 * Authentication type definitions
 * 
 * This file contains TypeScript type definitions for authentication-related data
 * structures and interfaces used throughout the application.
 */

/**
 * Enumeration of available user roles for authorization
 * Used to implement role-based access control as specified in the system requirements
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  GUEST = 'guest'
}

/**
 * Minimal user interface for authentication context
 * Contains essential user data needed for authentication purposes
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Interface for login form data
 * Used when submitting login credentials to the authentication API
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Interface for registration form data
 * Used when submitting new user registration data to the API
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Interface for authentication API response
 * Represents the structure of data returned from the authentication endpoints
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/**
 * Interface for authentication context state
 * Represents the current authentication state in the application
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
}

/**
 * Interface for password reset request data
 * Used when initiating the password reset flow
 */
export interface ResetPasswordData {
  email: string;
}