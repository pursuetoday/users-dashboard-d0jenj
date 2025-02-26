/**
 * CORS (Cross-Origin Resource Sharing) configuration for the backend API
 * Implements secure cross-origin policies and environment-specific settings with enhanced security measures
 * 
 * @module config/cors
 * @version 1.0.0
 */

import { CorsOptions } from 'cors'; // cors@2.8.5
import { CorsConfig } from '../interfaces/config.interface';

/**
 * Regular expression pattern for validating allowed origins
 * Only allows HTTPS connections to subdomains of the main domain in production
 */
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/[a-zA-Z0-9-]+\.yourdomain\.com$/;

/**
 * Returns environment-specific CORS configuration with enhanced security measures
 * @returns {CorsOptions} Secure CORS configuration object
 */
const getCorsConfig = (): CorsOptions => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Development configuration with simpler settings
  if (isDevelopment) {
    return {
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 86400,
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      preflightContinue: false,
      optionsSuccessStatus: 204
    };
  }
  
  // Production configuration with stricter security
  return {
    origin: (origin, callback) => {
      // Skip origin check for same-domain requests (origin is null/undefined)
      if (!origin) {
        return callback(null, true);
      }
      
      // Validate origin against allowed pattern (secure subdomain check)
      if (ALLOWED_ORIGIN_PATTERN.test(origin)) {
        return callback(null, true);
      }
      
      // Log and block invalid origins
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400, // 24 hours in seconds
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
};

/**
 * Production-ready CORS configuration with enhanced security measures
 * - Implements strict origin validation for production environments
 * - Supports relaxed settings for development
 * - Enforces HTTPS in production 
 * - Controls header exposure for security
 * - Optimizes preflight caching for performance
 */
export const corsConfig: CorsOptions = getCorsConfig();

// Explicitly export for direct imports
export default corsConfig;