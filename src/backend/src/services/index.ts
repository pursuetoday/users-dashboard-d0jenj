/**
 * Services Barrel File
 * 
 * This file exports all service modules for centralized access to core functionality:
 * - AuthService: Authentication and token management
 * - UserService: User management and CRUD operations
 * - CacheService: Redis-based caching for performance optimization
 * 
 * This centralized export pattern enables cleaner imports throughout the application
 * and encourages proper separation of concerns through the service layer architecture.
 * 
 * @version 1.0.0
 */

// Authentication service for user authentication, token management, and security operations
export { AuthService } from './auth.service';

// User service for user data management, validation, and role-based access control
export { UserService } from './user.service';

// Cache service for Redis-based caching, performance optimization, and distributed state
export { CacheService } from './cache.service';