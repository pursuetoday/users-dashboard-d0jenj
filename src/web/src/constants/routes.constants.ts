/**
 * routes.constants.ts
 * 
 * Centralized route path constants for the User Management Dashboard application.
 * This file defines all public, private, and error route paths used throughout the application.
 * Routes are categorized for supporting the role-based permission system and navigation hierarchy.
 */

/**
 * Constants for public route paths accessible without authentication
 */
export const PUBLIC_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
} as const;

/**
 * Constants for protected route paths requiring authentication
 */
export const PRIVATE_ROUTES = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const;

/**
 * Constants for error route paths
 */
export const ERROR_ROUTES = {
  NOT_FOUND: '/404',
  ERROR: '/error',
} as const;

/**
 * Aggregated export of all route path constants
 */
export const ROUTE_PATHS = {
  PUBLIC_ROUTES,
  PRIVATE_ROUTES,
  ERROR_ROUTES,
} as const;