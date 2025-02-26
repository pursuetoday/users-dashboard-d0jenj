/**
 * Middleware Index Module
 * 
 * Centralized export file that aggregates and re-exports all Express middleware functions 
 * used in the application for authentication, authorization, request validation, rate limiting,
 * logging, and error handling. Provides a clean, type-safe API for middleware integration
 * with proper execution order and comprehensive security features.
 * 
 * @module middleware
 */

import { RequestHandler, ErrorRequestHandler } from 'express';
import loggerMiddleware from './logger.middleware';
import { errorHandler } from './error-handler.middleware';
import rateLimiterMiddleware from './rate-limiter.middleware';
import { validateRequest } from './request-validator.middleware';
import { authenticate, authorize } from './auth.middleware';

// Type definitions for middleware factory functions
type RequestValidatorFactory = typeof validateRequest;
type AuthorizationMiddlewareFactory = typeof authorize;

/**
 * Express middleware for request/response logging with ELK Stack integration.
 * Implements comprehensive logging for security monitoring, performance tracking,
 * and audit trail requirements.
 * 
 * @type {RequestHandler} Express middleware function
 */
export { loggerMiddleware };

/**
 * Express middleware for centralized error handling with security considerations.
 * Processes errors, logs them to ELK Stack, and returns secure standardized responses
 * with appropriate HTTP status codes.
 * 
 * @type {ErrorRequestHandler} Express error handling middleware function
 */
export { errorHandler };

/**
 * Express middleware for rate limiting using token bucket algorithm.
 * Prevents API abuse by limiting requests to 100 per minute per IP address
 * with RFC-compliant headers and standardized error responses.
 * 
 * @type {RequestHandler} Express middleware function
 */
export { rateLimiterMiddleware };

/**
 * Express middleware factory for request validation with schema support.
 * Creates middleware that validates and sanitizes request data based on
 * provided schemas with comprehensive error handling and security features.
 * 
 * @type {RequestValidatorFactory} Middleware factory function
 */
export { validateRequest };

/**
 * Express middleware for JWT authentication with comprehensive security checks.
 * Verifies authentication tokens, handles token validation, and implements
 * blacklist checking and security headers.
 * 
 * @type {RequestHandler} Express middleware function
 */
export { authenticate };

/**
 * Express middleware factory for role-based authorization with granular permission control.
 * Creates middleware that checks user roles against allowed roles for route access,
 * with caching for performance optimization.
 * 
 * @type {AuthorizationMiddlewareFactory} Middleware factory function
 */
export { authorize };

/**
 * Recommended middleware registration order for optimal security and functionality:
 * 
 * 1. loggerMiddleware - Logging should be first to capture all request data
 * 2. rateLimiterMiddleware - Rate limiting should be early to prevent abuse
 * 3. authenticate - Authentication verifies user identity
 * 4. authorize - Authorization checks user permissions
 * 5. validateRequest - Request validation ensures data integrity
 * 6. errorHandler - Error handling should be last to catch all errors
 * 
 * Example usage:
 * 
 * ```typescript
 * import express from 'express';
 * import { 
 *   loggerMiddleware, 
 *   rateLimiterMiddleware, 
 *   authenticate, 
 *   authorize, 
 *   validateRequest, 
 *   errorHandler 
 * } from './middleware';
 * 
 * const app = express();
 * 
 * // Apply global middleware
 * app.use(express.json());
 * app.use(loggerMiddleware);
 * app.use(rateLimiterMiddleware);
 * 
 * // Protected routes
 * app.use('/api', authenticate);
 * app.use('/api/admin', authorize(['admin']));
 * 
 * // Route-specific validation
 * app.post('/api/users', validateRequest(userSchema), userController.create);
 * 
 * // Error handler (always last)
 * app.use(errorHandler);
 * ```
 */