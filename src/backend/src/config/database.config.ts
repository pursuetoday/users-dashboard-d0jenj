/**
 * Database Configuration Module
 * 
 * Provides configuration for PostgreSQL database connection with:
 * - Connection pooling for performance optimization
 * - SSL security configuration
 * - Environment-specific settings
 * - Validation for configuration parameters
 */

import { config } from 'dotenv'; // dotenv ^16.0.0
import { validateConfig } from 'env-validator'; // env-validator ^2.0.0
import { DatabaseConfig } from '../interfaces/config.interface';

// Default configuration constants
const DEFAULT_POOL_MIN = 2;
const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT = 30000; // 30 seconds
const DEFAULT_CONNECTION_TIMEOUT = 2000; // 2 seconds

// Configuration limits
const MIN_POOL_SIZE = 1;
const MAX_POOL_SIZE = 20;
const MIN_CONNECTION_TIMEOUT = 1000; // 1 second
const MAX_IDLE_TIMEOUT = 60000; // 60 seconds

/**
 * Validates pool configuration values against acceptable ranges and types
 * 
 * @param poolConfig - The pool configuration object to validate
 * @returns Boolean indicating if the configuration is valid
 */
function validatePoolConfig(poolConfig: any): boolean {
  // Check min/max relationship
  if (poolConfig.min > poolConfig.max) {
    console.error('Pool configuration error: min connections cannot exceed max connections');
    return false;
  }
  
  // Validate pool size limits
  if (poolConfig.min < MIN_POOL_SIZE || poolConfig.max > MAX_POOL_SIZE) {
    console.error(`Pool configuration error: pool size must be between ${MIN_POOL_SIZE} and ${MAX_POOL_SIZE}`);
    return false;
  }
  
  // Validate timeout values
  if (poolConfig.idleTimeoutMillis < 0 || !Number.isInteger(poolConfig.idleTimeoutMillis)) {
    console.error('Pool configuration error: idle timeout must be a positive integer');
    return false;
  }
  
  // Check that idle timeout is greater than connection timeout
  if (poolConfig.idleTimeoutMillis < DEFAULT_CONNECTION_TIMEOUT) {
    console.error(`Pool configuration error: idle timeout should be greater than connection timeout (${DEFAULT_CONNECTION_TIMEOUT}ms)`);
    return false;
  }
  
  // Verify pool limits against system resources
  if (poolConfig.max > 20) {
    console.warn('Pool configuration warning: high max pool size may consume excessive resources');
  }
  
  return true;
}

/**
 * Retrieves and validates database configuration from environment variables
 * with comprehensive type safety and default values
 * 
 * @returns Fully validated database configuration object
 * @throws Error if configuration is invalid
 */
function getDatabaseConfig(): DatabaseConfig {
  // Load environment variables
  config();
  
  // Define environment variable schema for validation
  const envSchema = {
    DATABASE_URL: { type: 'string', required: true },
    DATABASE_POOL_MIN: { type: 'integer', default: DEFAULT_POOL_MIN, min: MIN_POOL_SIZE, max: MAX_POOL_SIZE },
    DATABASE_POOL_MAX: { type: 'integer', default: DEFAULT_POOL_MAX, min: MIN_POOL_SIZE, max: MAX_POOL_SIZE },
    DATABASE_POOL_IDLE_TIMEOUT: { type: 'integer', default: DEFAULT_IDLE_TIMEOUT, min: MIN_CONNECTION_TIMEOUT, max: MAX_IDLE_TIMEOUT },
    DATABASE_SSL_ENABLED: { type: 'boolean', default: false },
    DATABASE_SSL_REJECT_UNAUTHORIZED: { type: 'boolean', default: true },
    DATABASE_SSL_CA: { type: 'string', required: false },
    DATABASE_REPLICATION_ENABLED: { type: 'boolean', default: false },
    DATABASE_MASTER_URL: { type: 'string', required: false },
    DATABASE_SLAVE_URLS: { type: 'string', required: false },
    DATABASE_LOGGING: { type: 'boolean', default: false },
  };
  
  // Validate environment variables
  const validatedEnv = validateConfig(process.env, envSchema);
  
  // Database URL validation
  const dbUrl = validatedEnv.DATABASE_URL;
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    throw new Error('Invalid DATABASE_URL format. Must start with postgres:// or postgresql://');
  }
  
  // Parse pool configuration with defaults
  const poolConfig = {
    min: validatedEnv.DATABASE_POOL_MIN,
    max: validatedEnv.DATABASE_POOL_MAX,
    idleTimeoutMillis: validatedEnv.DATABASE_POOL_IDLE_TIMEOUT,
  };
  
  if (!validatePoolConfig(poolConfig)) {
    throw new Error('Invalid database pool configuration');
  }
  
  // Parse SSL configuration
  const sslConfig = {
    enabled: validatedEnv.DATABASE_SSL_ENABLED,
    rejectUnauthorized: validatedEnv.DATABASE_SSL_REJECT_UNAUTHORIZED,
    ca: validatedEnv.DATABASE_SSL_CA,
  };
  
  // Parse replication configuration
  const replicationConfig = {
    enabled: validatedEnv.DATABASE_REPLICATION_ENABLED,
    master: validatedEnv.DATABASE_REPLICATION_ENABLED && validatedEnv.DATABASE_MASTER_URL
      ? { url: validatedEnv.DATABASE_MASTER_URL }
      : undefined,
    slaves: validatedEnv.DATABASE_REPLICATION_ENABLED && validatedEnv.DATABASE_SLAVE_URLS
      ? validatedEnv.DATABASE_SLAVE_URLS.split(',').map(url => ({ url: url.trim() }))
      : undefined
  };
  
  // Construct and return the database configuration
  return {
    url: dbUrl,
    pool: poolConfig,
    ssl: sslConfig,
    replication: replicationConfig,
    logging: validatedEnv.DATABASE_LOGGING
  };
}

// Export the validated database configuration
export const databaseConfig = getDatabaseConfig();