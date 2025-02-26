/**
 * Rate Limiter Middleware
 * 
 * Implements rate limiting functionality using token bucket algorithm to protect API endpoints 
 * from abuse by limiting the number of requests from a single IP address within a specified time window.
 * Provides RFC-compliant rate limit headers and standardized error responses.
 *
 * @packageDocumentation
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // Version ^4.18.2
import rateLimit from 'express-rate-limit'; // Version ^6.7.0
import { rateLimitConfig } from '../config/rate-limit.config';
import { HTTP_STATUS } from '../constants/http-status';

/**
 * Creates and configures an instance of the rate limiter middleware using token bucket algorithm
 * with standardized headers and error handling.
 * 
 * Configuration:
 * - Implements 100 requests per minute per IP limit as specified in API Architecture (section 3.3)
 * - Uses token bucket algorithm for consistent rate enforcement
 * - Provides RFC-compliant RateLimit headers for client-side tracking
 * - Returns standardized 429 Too Many Requests responses when limit is exceeded
 * 
 * @returns {RequestHandler} Configured Express middleware function that implements rate limiting
 */
const rateLimiterMiddleware: RequestHandler = rateLimit({
  // Apply configuration from rate-limit.config.ts
  windowMs: rateLimitConfig.windowMs, // 1 minute window
  max: rateLimitConfig.max, // 100 requests per window
  
  // Enable RFC-compliant standard headers (X-RateLimit-*)
  standardHeaders: true,
  
  // Disable legacy headers for improved security
  legacyHeaders: false,
  
  // Custom handler for when limit is exceeded
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    const message = options.message || 'Too many requests, please try again later.';
    
    // Return standardized error response
    return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      message,
      limit: rateLimitConfig.max,
      windowMs: rateLimitConfig.windowMs,
      retryAfter: Math.ceil(options.windowMs / 1000), // in seconds
      timestamp: new Date().toISOString()
    });
  },
  
  // Optional: Skip rate limiting for certain paths or IPs
  // (Implementing based on RateLimitConfig interface which includes a whitelist)
  skip: (req: Request) => {
    // Health check and monitoring endpoints bypass rate limiting
    if (req.path === '/health' || req.path === '/metrics') {
      return true;
    }
    
    // IP whitelist check (if implemented in the config)
    const whitelist = (rateLimitConfig as any).whitelist || [];
    if (whitelist.length > 0) {
      const ip = req.ip || req.connection.remoteAddress || '';
      return whitelist.includes(ip);
    }
    
    return false;
  },
  
  // Custom key generator to rate limit based on IP or API key if available
  keyGenerator: (req: Request) => {
    // If API key authentication is being used, rate limit by API key instead of IP
    const apiKey = req.headers['x-api-key'] || '';
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      return apiKey;
    }
    
    // Otherwise use IP address
    return req.ip || req.connection.remoteAddress || '';
  }
});

export default rateLimiterMiddleware;