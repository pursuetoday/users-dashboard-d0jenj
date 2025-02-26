/**
 * Central configuration module that aggregates and exports all application configurations
 * including authentication, database, caching, rate limiting, and CORS settings with
 * enhanced validation, environment detection, and configuration management capabilities.
 * 
 * @module config
 * @version 1.0.0
 */

import { authConfig } from './auth.config';
import cacheConfig from './cache.config';
import { corsConfig } from './cors.config';
import { databaseConfig } from './database.config';
import { rateLimitConfig } from './rate-limit.config';
import type { Config, LoggerConfig, RateLimitConfig, CorsConfig } from '../interfaces/config.interface';

/**
 * Validates the complete configuration object for required values and correct types
 * 
 * @param configObject Configuration object to validate
 * @returns True if configuration is valid, throws error if invalid
 */
export function validateConfig(configObject: Partial<Config>): boolean {
  // Check for required configuration sections
  if (!configObject.auth) {
    throw new Error('Missing authentication configuration');
  }

  if (!configObject.database) {
    throw new Error('Missing database configuration');
  }

  if (!configObject.cache) {
    throw new Error('Missing cache configuration');
  }

  if (!configObject.rateLimit) {
    throw new Error('Missing rate limit configuration');
  }

  if (!configObject.cors) {
    throw new Error('Missing CORS configuration');
  }
  
  if (!configObject.logger) {
    throw new Error('Missing logger configuration');
  }
  
  // Explicitly check for required properties from each configuration
  
  // Auth configuration - specifically check properties referenced in imported_file_path
  if (!configObject.auth.jwtSecret) {
    throw new Error('Missing JWT secret in authentication configuration');
  }
  
  if (!configObject.auth.accessTokenExpiration) {
    throw new Error('Missing access token expiration in authentication configuration');
  }
  
  if (!configObject.auth.refreshTokenExpiration) {
    throw new Error('Missing refresh token expiration in authentication configuration');
  }
  
  // Database configuration
  if (!configObject.database.url) {
    throw new Error('Missing database URL in database configuration');
  }
  
  if (!configObject.database.pool) {
    throw new Error('Missing connection pool configuration in database configuration');
  }
  
  // Cache configuration
  if (!configObject.cache.url) {
    throw new Error('Missing Redis URL in cache configuration');
  }
  
  if (typeof configObject.cache.ttl !== 'number') {
    throw new Error('Missing or invalid TTL in cache configuration');
  }
  
  // Rate limit configuration
  if (typeof configObject.rateLimit.windowMs !== 'number') {
    throw new Error('Missing or invalid windowMs in rate limit configuration');
  }
  
  if (typeof configObject.rateLimit.max !== 'number') {
    throw new Error('Missing or invalid max requests in rate limit configuration');
  }
  
  // CORS configuration
  if (!configObject.cors.origin) {
    throw new Error('Missing origin in CORS configuration');
  }
  
  if (!Array.isArray(configObject.cors.methods)) {
    throw new Error('Missing or invalid methods in CORS configuration');
  }
  
  if (typeof configObject.cors.credentials !== 'boolean') {
    throw new Error('Missing or invalid credentials in CORS configuration');
  }
  
  // Verify environment settings
  if (!configObject.env) {
    throw new Error('Missing environment setting');
  }
  
  if (typeof configObject.isProduction !== 'boolean') {
    throw new Error('Missing or invalid isProduction flag');
  }
  
  // Verify cross-configuration compatibility and security in production
  if (configObject.isProduction) {
    // In production, ensure SSL is enabled for database connections
    if (configObject.database.ssl && !configObject.database.ssl.enabled) {
      console.warn('Security warning: SSL is not enabled for database connections in production environment');
    }
    
    // In production, ensure Redis connection uses SSL (starts with rediss://)
    if (configObject.cache.url && !configObject.cache.url.startsWith('rediss://')) {
      console.warn('Security warning: Redis connection does not use SSL in production environment');
    }
    
    // In production, ensure JWT token expiration is not too long (access token)
    const accessTokenMatch = configObject.auth.accessTokenExpiration.match(/^(\d+)([mhd])$/);
    if (accessTokenMatch) {
      const [, valueStr, unit] = accessTokenMatch;
      const value = parseInt(valueStr, 10);
      
      if (unit === 'h' && value > 1) {
        console.warn(`Security warning: Access token expiration (${configObject.auth.accessTokenExpiration}) exceeds recommended limit in production`);
      } else if (unit === 'd') {
        console.warn(`Security warning: Access token expiration (${configObject.auth.accessTokenExpiration}) is in days, which is too long for production`);
      }
    }
    
    // Validate relationships between dependent configurations
    if (configObject.cache.ttl > 86400) {
      console.warn('Cache TTL exceeds 24 hours, which may lead to stale data');
    }
  }
  
  return true;
}

/**
 * Recursively deep merges source objects into target object
 * 
 * @param target Target object to merge into
 * @param sources Source objects to merge from
 * @returns Merged result
 */
function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  
  const source = sources.shift();
  if (!source) return target;
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return deepMerge(target, ...sources);
}

/**
 * Checks if value is an object (and not null)
 */
function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Creates and memoizes the configuration object with environment detection
 * 
 * @returns Complete configuration object with all settings
 */
export function createConfig(): Config {
  // Detect current environment
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  
  // Create default logger configuration
  const loggerConfig: LoggerConfig = {
    level: (isProduction ? 'info' : 'debug') as 'debug' | 'info' | 'warn' | 'error',
    format: isProduction ? 'json' : 'dev',
    file: {
      enabled: isProduction,
      path: process.env.LOG_FILE_PATH || 'logs/app.log'
    },
    rotation: {
      enabled: isProduction,
      maxSize: '10m',
      maxFiles: 5,
      compress: true
    }
  };
  
  // Ensure rate limit config matches interface
  const completeRateLimitConfig: RateLimitConfig = {
    windowMs: rateLimitConfig.windowMs,
    max: rateLimitConfig.max,
    skipFailedRequests: rateLimitConfig.skipFailedRequests || false,
    whitelist: rateLimitConfig.whitelist || []
  };
  
  // Ensure CORS config matches interface
  const completeCorsConfig: CorsConfig = {
    origin: corsConfig.origin,
    methods: corsConfig.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: corsConfig.credentials,
    exposedHeaders: corsConfig.exposedHeaders || [],
    maxAge: corsConfig.maxAge || 86400
  };
  
  // Create base configuration
  const baseConfig = {
    env,
    isProduction,
    auth: authConfig,
    database: databaseConfig,
    cache: cacheConfig,
    cors: completeCorsConfig,
    rateLimit: completeRateLimitConfig,
    logger: loggerConfig
  } as Config;
  
  // Add environment-specific overrides
  let environmentConfig: Partial<Config> = {};
  
  // Apply production-specific settings
  if (isProduction) {
    environmentConfig = {
      // Production-specific overrides
      rateLimit: {
        ...completeRateLimitConfig,
        // More restrictive in production
        max: Math.min(completeRateLimitConfig.max, 50) // More conservative limit
      }
    };
  } else if (env === 'test') {
    // Test environment settings
    environmentConfig = {
      cache: {
        ...cacheConfig,
        ttl: 60 // 1 minute TTL for tests
      },
      rateLimit: {
        ...completeRateLimitConfig,
        max: 1000 // Higher limit for tests to avoid false positives
      },
      logger: {
        ...loggerConfig,
        level: 'error', // Only log errors in tests
        file: {
          enabled: false // Disable file logging in tests
        }
      }
    };
  }
  
  // Deep merge configurations with the base config
  const mergedConfig = deepMerge({} as Config, baseConfig, environmentConfig);
  
  // Always ensure these values are correct after merging
  mergedConfig.env = env;
  mergedConfig.isProduction = isProduction;
  
  // Validate the complete configuration
  validateConfig(mergedConfig);
  
  // Return frozen object to prevent modifications
  return Object.freeze(mergedConfig);
}

// Create and export the configuration singleton
export const config = createConfig();

// Default export for ease of importing
export default config;