/**
 * Services Module Barrel File
 * 
 * Central export point for all service instances and types in the application.
 * Provides consistent access to API, authentication, user management, and storage services
 * while ensuring proper initialization order and dependency management.
 * 
 * @packageDocumentation
 * @module services
 * @version 1.0.0
 */

// Import services in dependency order (core API service first)
import { apiService } from './api.service';
import { StorageService } from './storage.service';
import { authService } from './auth.service';
import { userService } from './user.service';

/**
 * Custom error class for service-specific errors with additional context
 * Provides standardized error handling across all services
 */
export class ServiceError extends Error {
  /**
   * Creates a new ServiceError instance
   * @param message - Error message
   * @param code - Error code for programmatic handling
   * @param service - Name of the service that generated the error
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly service: string
  ) {
    super(message);
    this.name = 'ServiceError';
    
    // Maintains proper stack trace in modern JavaScript engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }
}

// Re-export all services and the custom error class
export { apiService, StorageService, authService, userService };