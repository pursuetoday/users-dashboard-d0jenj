/**
 * Authentication Routes
 * 
 * This module defines the Express router configuration for authentication endpoints
 * with comprehensive security measures, request validation, and rate limiting
 * for login, registration, token refresh, password reset, and logout operations.
 * 
 * @module routes/auth.routes
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0

import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/request-validator.middleware';
import { 
  loginSchema, 
  registerSchema, 
  resetPasswordSchema 
} from '../validators/auth.validator';

// Create a new router instance
const router = Router();

/**
 * Initializes and configures all authentication routes with enhanced security middleware,
 * validation, and rate limiting
 * 
 * @param authController - Instance of AuthController for handling auth operations
 * @returns Configured Express router with secured auth routes
 */
function initializeAuthRoutes(authController: AuthController): Router {
  // Configure rate limiters for different authentication operations with varying strictness
  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many login attempts, please try again later'
    }
  });

  const registerRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 accounts per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many registration attempts, please try again later'
    }
  });

  const resetPasswordRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many password reset attempts, please try again later'
    }
  });

  const refreshTokenRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 refresh attempts per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many token refresh attempts, please try again later'
    }
  });

  // Login route with rate limiting and validation
  router.post('/login', 
    loginRateLimiter,
    validateRequest(loginSchema),
    authController.login.bind(authController)
  );
  
  // Registration route with rate limiting and validation
  router.post('/register', 
    registerRateLimiter,
    validateRequest(registerSchema),
    authController.register.bind(authController)
  );
  
  // Token refresh route with authentication and rate limiting
  router.post('/refresh', 
    refreshTokenRateLimiter,
    authenticate,
    authController.refreshToken.bind(authController)
  );
  
  // Logout route with authentication
  router.post('/logout', 
    authenticate,
    authController.logout.bind(authController)
  );
  
  // Password reset route with rate limiting and validation
  router.post('/reset-password', 
    resetPasswordRateLimiter,
    validateRequest(resetPasswordSchema),
    authController.resetPassword.bind(authController)
  );

  // Apply generic error handling middleware for authentication routes
  router.use((err: any, req: any, res: any, next: any) => {
    console.error('Authentication route error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred during authentication';
    
    res.status(statusCode).json({
      success: false,
      status: statusCode,
      message: message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });
  
  return router;
}

export { router, initializeAuthRoutes };