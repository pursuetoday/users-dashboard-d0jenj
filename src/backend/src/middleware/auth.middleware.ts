/**
 * Authentication and Authorization Middleware
 * 
 * This middleware implements secure JWT-based authentication and role-based
 * access control for protected API routes with enhanced security features,
 * performance optimizations, and comprehensive error handling.
 *
 * Features:
 * - JWT token validation with signature verification
 * - Token blacklist check via Redis
 * - Role-based access control (RBAC)
 * - Performance optimization with Redis caching
 * - Security headers for XSS protection
 * - Rate limiting for brute force protection
 * - Comprehensive audit logging
 *
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import Redis from 'ioredis'; // ^5.0.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import winston from 'winston'; // ^3.8.0

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { verifyToken } from '../utils/jwt.util';
import { HTTP_STATUS } from '../constants/http-status';
import { AuthenticationError } from '../utils/error.util';
import { AUTH_ERRORS } from '../constants/error-messages';

/**
 * Extended Request interface with authenticated user data
 */
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Initialize Redis client for token blacklist and caching
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Configure logger for authentication events
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Rate limiter for authentication attempts
 * Prevents brute force attacks by limiting request frequency
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      message: SYSTEM_ERRORS.RATE_LIMIT_EXCEEDED || 'Too many authentication attempts, please try again later',
    });
  },
});

/**
 * Adds security headers to response
 * Implements recommended security headers to protect against common web vulnerabilities
 * 
 * @param res - Express Response object
 */
function addSecurityHeaders(res: Response): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Enable browser XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Force HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/**
 * Express middleware that authenticates requests by validating JWT tokens
 * with enhanced security checks and performance optimizations
 * 
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction
 * @returns Promise<void> - Continues to next middleware if authenticated, throws appropriate error if not
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_MISSING, {
        message: 'No authentication token provided or invalid format',
      });
    }

    const token = authHeader.split(' ')[1].trim();
    if (!token) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_MISSING, {
        message: 'Empty authentication token',
      });
    }

    // Validate token format (simple regex for JWT format)
    const tokenRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    if (!tokenRegex.test(token)) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token does not match JWT format',
      });
    }

    // Check if token is blacklisted (revoked)
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
        message: 'Token has been revoked',
      });
    }

    // Check cache for previously validated tokens to improve performance
    const cachedPayload = await redisClient.get(`token:${token}`);
    let payload: JwtPayload;
    
    if (cachedPayload) {
      // Use cached token validation result
      payload = JSON.parse(cachedPayload);
      logger.debug('Using cached token validation', { userId: payload.sub });
    } else {
      // Verify token cryptographically
      payload = verifyToken(token);
      
      // Validate required fields in token payload
      if (!payload.sub || !payload.role) {
        throw new AuthenticationError(AUTH_ERRORS.TOKEN_INVALID, {
          message: 'Token missing required claims (sub, role)',
        });
      }
      
      // Cache successful validation for 5 minutes
      await redisClient.set(
        `token:${token}`,
        JSON.stringify(payload),
        'EX',
        300 // 5 minutes
      );
      
      logger.debug('Token validation cached', { userId: payload.sub });
    }

    // Attach user data to request object for use in route handlers
    req.user = payload;
    
    // Add security headers to response
    addSecurityHeaders(res);

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: payload.sub,
      role: payload.role,
      path: req.originalUrl,
      method: req.method,
    });

    next();
  } catch (error) {
    // Handle authentication errors
    logger.error('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    if (error instanceof AuthenticationError) {
      res.status(error.statusCode).json({
        success: false,
        status: error.statusCode,
        message: error.message,
        details: error.details,
      });
    } else {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        status: HTTP_STATUS.UNAUTHORIZED,
        message: AUTH_ERRORS.UNAUTHORIZED,
      });
    }
  }
}

/**
 * Express middleware that implements role-based access control with caching and audit logging
 * 
 * @param allowedRoles - Array of roles that are permitted to access the route
 * @returns Express middleware function that handles authorization with enhanced security
 */
export function authorize(allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthenticationError(AUTH_ERRORS.UNAUTHORIZED, {
          message: 'Authentication required before authorization',
        });
      }

      const { sub, role } = req.user;

      // Validate role exists and is valid format
      if (!role || typeof role !== 'string') {
        throw new AuthenticationError(AUTH_ERRORS.UNAUTHORIZED, {
          message: 'Invalid user role in authentication token',
        });
      }

      // Check cache for authorization decision to improve performance
      const cacheKey = `auth:${sub}:${role}:${allowedRoles.join(',')}`;
      const cachedPermission = await redisClient.get(cacheKey);
      
      if (cachedPermission) {
        // Use cached authorization result
        if (cachedPermission === 'allowed') {
          return next();
        } else {
          throw new AuthenticationError(AUTH_ERRORS.UNAUTHORIZED, {
            message: 'Insufficient permissions for this resource',
            requiredRoles: allowedRoles,
            userRole: role,
          });
        }
      }

      // Check if user's role is included in allowed roles
      const isAuthorized = allowedRoles.includes(role);
      
      // Cache authorization result for 15 minutes
      await redisClient.set(
        cacheKey,
        isAuthorized ? 'allowed' : 'denied',
        'EX',
        900 // 15 minutes
      );

      if (isAuthorized) {
        // Log successful authorization
        logger.info('Authorization successful', {
          userId: sub,
          role,
          allowedRoles,
          resource: req.originalUrl,
          method: req.method,
        });
        
        next();
      } else {
        // Log failed authorization attempt
        logger.warn('Authorization failed', {
          userId: sub,
          role,
          allowedRoles,
          resource: req.originalUrl,
          method: req.method,
          ip: req.ip,
        });
        
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: AUTH_ERRORS.UNAUTHORIZED,
          details: {
            message: 'Insufficient permissions for this resource',
            requiredRoles: allowedRoles,
            userRole: role,
          },
        });
      }
    } catch (error) {
      // Handle authorization errors
      logger.error('Authorization error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resource: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });
      
      if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
          success: false,
          status: error.statusCode,
          message: error.message,
          details: error.details,
        });
      } else {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: AUTH_ERRORS.UNAUTHORIZED,
        });
      }
    }
  };
}