/**
 * Central type definitions for User Management Dashboard
 * 
 * This file exports all type definitions used throughout the frontend application,
 * providing a centralized type system for consistent type usage across the system.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// Import all types from modules
import * as api from './api.types';
import * as auth from './auth.types';
import * as form from './form.types';
import * as theme from './theme.types';
import * as user from './user.types';

/**
 * Generic interface for API responses with proper typing
 */
export interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
  timestamp: string;
}

/**
 * Comprehensive error interface for API error handling
 */
export interface ApiError {
  message: string;
  status: number;
  errors: Record<string, string[]>;
  code: string;
  timestamp: string;
}

/**
 * Enumeration of user roles for access control
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  GUEST = 'GUEST'
}

/**
 * Interface for authenticated user data
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: string[];
  lastLoginAt: string;
}

/**
 * Enumeration of form field types for form generation
 */
export enum FormFieldType {
  TEXT = 'text',
  PASSWORD = 'password',
  EMAIL = 'email',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio'
}

/**
 * Enumeration of theme modes for application theming
 */
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * Comprehensive interface for user data management
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  preferences: Record<string, unknown>;
}

// Re-export all non-conflicting types from modules
export {
  HttpMethod,
  ErrorType,
  PaginatedResponse,
  RequestConfig
} from './api.types';

export type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  AuthState,
  ResetPasswordData
} from './auth.types';

export type {
  FormValidationRule,
  FormField,
  FormState,
  FormConfig
} from './form.types';

export type {
  Theme,
  ThemeContextType,
  ThemeProviderProps
} from './theme.types';

export type {
  UserFormData,
  UserResponse,
  UsersResponse,
  UserFilters
} from './user.types';