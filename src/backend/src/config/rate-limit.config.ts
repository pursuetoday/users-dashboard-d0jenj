/**
 * Rate limiting configuration for the User Management Dashboard API
 * Implements token bucket algorithm to prevent abuse and ensure fair usage of system resources
 * 
 * @packageDocumentation
 */

import { RateLimitConfig } from '../interfaces/config.interface';
import type { RateLimiterOptions } from 'express-rate-limit'; // Version ^6.7.0

/**
 * Rate limit configuration implementing token bucket algorithm
 * that controls API usage to prevent abuse and ensure fair distribution of resources.
 * 
 * Current settings:
 * - 100 requests per minute per IP address
 * - Standard headers enabled for client-side rate tracking
 * - Clear error message provided when limit is exceeded
 */
export const rateLimitConfig: Partial<RateLimitConfig> & RateLimiterOptions = {
  // Time window in milliseconds (1 minute)
  windowMs: 60000,
  
  // Maximum number of requests per IP within the window
  max: 100,
  
  // Error message shown when rate limit is exceeded
  message: 'Too many requests from this IP, please try again later. Rate limit: 100 requests per minute.',
  
  // Enable standard headers following current best practices (X-RateLimit-*)
  standardHeaders: true,
  
  // Disable legacy headers for improved security
  legacyHeaders: false,
};

export default rateLimitConfig;