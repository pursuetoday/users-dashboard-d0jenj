/**
 * Central Routing Configuration
 * 
 * This module implements a secure, versioned API routing system with comprehensive
 * middleware integration, request validation, rate limiting, and monitoring capabilities.
 * It aggregates and exports all API routes including authentication, user management,
 * and health check endpoints.
 *
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import { validateRequest } from 'express-validator'; // ^7.0.0
import errorHandler from 'express-error-handler'; // ^1.1.0

// Import routes
import { router as authRouter } from './auth.routes';
import { router as userRouter } from './user.routes';
import healthRouter from './health.routes';

// Configure rate limiter
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute as per requirements
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});

/**
 * Initializes and configures all application routes with comprehensive middleware chain,
 * versioning, and security measures.
 * 
 * @returns {Router} Configured Express router with all application routes and middleware
 */
function initializeRoutes(): Router {
  // Create new Express router instance
  const router = Router();

  // Apply security headers using helmet middleware
  router.use(helmet({
    // Configure CORS with strict options
    crossOriginResourcePolicy: { policy: 'same-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
    hidePoweredBy: true
  }));

  // Apply rate limiting middleware (100 req/min as specified in requirements)
  router.use(rateLimiter);

  // Enable response compression
  router.use(compression());

  // Mount health check routes at /health
  router.use('/health', healthRouter);

  // Mount authentication routes at /api/v1/auth
  router.use('/api/v1/auth', authRouter);

  // Mount user management routes at /api/v1/users
  router.use('/api/v1/users', userRouter);

  // Apply error handling middleware
  router.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('API error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';
    
    res.status(statusCode).json({
      success: false,
      status: statusCode,
      message: message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  // Handle 404 - Keep this as the last route
  router.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      status: 404,
      message: 'Resource not found',
      path: req.url
    });
  });

  return router;
}

// Export configured router
export default initializeRoutes();