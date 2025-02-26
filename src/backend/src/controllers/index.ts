/**
 * Controller Barrel File
 * 
 * Centralizes all controller exports to provide a single source of truth for API endpoint handlers.
 * This file consolidates authentication, user management, and health check controllers
 * while maintaining proper encapsulation and security through controlled exports.
 * 
 * Serves as the central export point for all API endpoint handlers, ensuring consistent
 * access patterns and proper separation of concerns throughout the application.
 * 
 * @version 1.0.0
 */

import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { checkHealth } from './health.controller';

export {
  /**
   * Authentication controller providing comprehensive authentication flows
   * Handles login, registration, token refresh, logout, and password reset
   * with JWT-based security and robust error handling
   */
  AuthController,
  
  /**
   * User management controller with role-based access control
   * Provides secure CRUD operations for user data with validation,
   * sanitization, and comprehensive error handling
   */
  UserController,
  
  /**
   * Health check endpoint handler for system monitoring
   * Provides detailed metrics about API status, database connectivity,
   * and overall system health for infrastructure monitoring
   */
  checkHealth
};