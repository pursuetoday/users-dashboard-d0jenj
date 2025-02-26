/**
 * Redis Cache Configuration Module
 * 
 * Provides comprehensive configuration for Redis cache functionality including
 * connection details, TTL settings, cluster support, and retry strategies.
 * This configuration supports production-ready Redis deployments with
 * intelligent connection pooling and health monitoring.
 * 
 * @version Redis 7.x
 */

import { CacheConfig } from '../interfaces/config.interface';

/**
 * Validates the Redis cache configuration for security and correctness
 * 
 * @param url Redis connection URL
 * @param ttl Time-to-live in seconds for cached items
 * @param clusterEnabled Whether Redis cluster mode is enabled
 * @returns true if valid, throws error otherwise
 */
function validateCacheConfig(url: string, ttl: number, clusterEnabled: boolean): boolean {
  // Validate Redis URL format
  const redisUrlPattern = /^(redis|rediss):\/\/(.*:.+@)?([a-zA-Z0-9-_.]+)(:\d+)?(\/\d+)?$/;
  if (!redisUrlPattern.test(url)) {
    throw new Error('Invalid Redis URL format. Expected format: redis[s]://[user:pass@]host[:port][/db]');
  }

  // Recommend secure Redis connections in production
  if (process.env.NODE_ENV === 'production' && !url.startsWith('rediss://')) {
    console.warn('Warning: Using non-SSL Redis connection in production environment');
  }

  // Validate TTL range (between 1 minute and 24 hours)
  if (ttl < 60 || ttl > 86400) {
    throw new Error('Invalid Redis TTL. Value must be between 60 and 86400 seconds');
  }

  // Additional validation for cluster configuration if enabled
  if (clusterEnabled) {
    // In cluster mode, we expect the REDIS_CLUSTER_NODES environment variable to be set
    if (!process.env.REDIS_CLUSTER_NODES) {
      throw new Error('Redis cluster mode enabled but REDIS_CLUSTER_NODES environment variable is not set');
    }
  }

  return true;
}

/**
 * Generates a comprehensive Redis cache configuration object based on
 * environment variables with sensible defaults for production use
 * 
 * @returns Complete Redis cache configuration
 */
function getCacheConfig(): CacheConfig {
  // Extract configuration from environment variables with sensible defaults
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const ttl = parseInt(process.env.REDIS_TTL || '3600', 10);
  const clusterEnabled = process.env.REDIS_CLUSTER_ENABLED === 'true';
  
  // Parse cluster nodes if provided
  const clusterNodes = process.env.REDIS_CLUSTER_NODES
    ? process.env.REDIS_CLUSTER_NODES.split(',')
    : [];
  
  // Retry strategy settings
  const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10);
  const retryInterval = parseInt(process.env.REDIS_RETRY_INTERVAL || '100', 10);

  // Validate configuration
  validateCacheConfig(url, ttl, clusterEnabled);

  // Build the complete configuration object
  const config: CacheConfig = {
    url,
    ttl,
    cluster: {
      enabled: clusterEnabled,
      nodes: clusterEnabled ? clusterNodes : undefined,
      maxRedirections: clusterEnabled ? 16 : undefined,
    },
    retryStrategy: {
      maxAttempts: maxRetries,
      delay: retryInterval,
      exponentialBackoff: true,
    },
  };

  return config;
}

/**
 * Enhanced Cache Configuration Interface extending the base CacheConfig
 * with additional production features like connection pooling and health checks
 */
interface EnhancedCacheConfig extends CacheConfig {
  poolConfig: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    evictionRunIntervalMillis: number;
    idleTimeoutMillis: number;
  };
  healthCheck: {
    enabled: boolean;
    intervalMs: number;
    timeoutMs: number;
    command: string;
  };
}

/**
 * Enhanced cache configuration with additional production-ready settings
 * including connection pooling and health monitoring
 */
const cacheConfig: EnhancedCacheConfig = {
  ...getCacheConfig(),
  
  // Connection pool configuration for high-performance scenarios
  poolConfig: {
    min: parseInt(process.env.REDIS_POOL_MIN || '2', 10),
    max: parseInt(process.env.REDIS_POOL_MAX || '10', 10),
    // Connection acquirement timeout in milliseconds
    acquireTimeoutMillis: parseInt(process.env.REDIS_ACQUIRE_TIMEOUT || '10000', 10),
    // How often to check for idle connections to be removed
    evictionRunIntervalMillis: 30000,
    // Time before a connection is considered idle
    idleTimeoutMillis: 30000,
  },
  
  // Health check configuration for monitoring Redis connectivity
  healthCheck: {
    enabled: process.env.REDIS_HEALTH_CHECK_ENABLED !== 'false',
    intervalMs: parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000', 10),
    timeoutMs: parseInt(process.env.REDIS_HEALTH_CHECK_TIMEOUT || '5000', 10),
    // Command to use for health checks
    command: 'ping',
  }
};

export default cacheConfig;