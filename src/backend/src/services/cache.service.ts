/**
 * Cache Service
 * 
 * Provides Redis-based caching functionality with advanced features including
 * connection pooling, health monitoring, and comprehensive error handling.
 * Implements type-safe cache operations with TTL management and monitoring capabilities.
 * 
 * @version ioredis 5.0.0
 */

import Redis from 'ioredis';
import cacheConfig from '../config/cache.config';
import { BaseError } from '../utils/error.util';
import { CACHE_ERRORS } from '../constants/error-messages';
import { HTTP_STATUS } from '../constants/http-status';

/**
 * Custom error class for cache-related errors
 */
class CacheError extends BaseError {
  /**
   * Create a new CacheError instance
   * @param message - Error message
   * @param details - Additional error details (optional)
   */
  constructor(message: string, details?: any) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, details);
    this.name = 'CacheError';
  }
}

/**
 * Advanced service class managing Redis cache operations with connection pooling,
 * health monitoring, and comprehensive error handling
 */
export class CacheService {
  private client: Redis;
  private defaultTTL: number;
  private isConnected: boolean = false;
  private metrics: {
    hits: number;
    misses: number;
    errors: number;
    operations: {
      set: number;
      get: number;
      delete: number;
    };
    lastError?: {
      message: string;
      timestamp: number;
    };
  };

  /**
   * Initializes Redis client with advanced configuration and monitoring
   */
  constructor() {
    try {
      // Initialize Redis client with connection pooling from cacheConfig.url
      this.client = new Redis(cacheConfig.url, {
        // Configure retry strategy from cacheConfig.retryStrategy
        retryStrategy: (times: number) => {
          if (times > cacheConfig.retryStrategy.maxAttempts) {
            return null; // Stop retrying after max attempts
          }
          
          // Exponential backoff if enabled
          const delay = cacheConfig.retryStrategy.exponentialBackoff
            ? Math.min(times * cacheConfig.retryStrategy.delay, 10000)
            : cacheConfig.retryStrategy.delay;
            
          return delay;
        },
        maxRetriesPerRequest: cacheConfig.retryStrategy.maxAttempts,
        connectTimeout: cacheConfig.poolConfig.acquireTimeoutMillis,
        keepAlive: 10000,
        enableOfflineQueue: true,
      });

      // Set default TTL from cacheConfig.ttl
      this.defaultTTL = cacheConfig.ttl;

      // Initialize metrics collection
      this.metrics = {
        hits: 0,
        misses: 0,
        errors: 0,
        operations: {
          set: 0,
          get: 0,
          delete: 0,
        }
      };

      // Setup comprehensive error event handlers
      this.client.on('error', (err) => {
        this.isConnected = false;
        this.metrics.errors++;
        this.metrics.lastError = {
          message: err.message,
          timestamp: Date.now()
        };
        console.error('[CACHE] Connection error:', err.message);
      });

      // Setup connection monitoring events
      this.client.on('connect', () => {
        this.isConnected = true;
        console.info('[CACHE] Connected to Redis server');
      });

      this.client.on('reconnecting', () => {
        console.info('[CACHE] Reconnecting to Redis server...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        console.info('[CACHE] Redis client ready');
      });

      // Initialize health check interval
      if (cacheConfig.healthCheck.enabled) {
        setInterval(() => {
          this.healthCheck().catch(err => {
            console.error('[CACHE] Health check failed:', err.message);
          });
        }, cacheConfig.healthCheck.intervalMs);
      }

      // Setup circuit breaker for connection failures
      let consecutiveFailures = 0;
      const maxFailures = 5;
      let circuitOpen = false;
      const resetTimeout = 30000; // 30 seconds
      
      this.client.on('error', () => {
        consecutiveFailures++;
        if (consecutiveFailures >= maxFailures && !circuitOpen) {
          circuitOpen = true;
          console.error(`[CACHE] Circuit breaker triggered after ${maxFailures} consecutive failures`);
          
          // After a timeout, try to reconnect and close the circuit
          setTimeout(() => {
            console.info('[CACHE] Attempting to reset circuit breaker...');
            circuitOpen = false;
            this.client.connect();
          }, resetTimeout);
        }
      });

      this.client.on('connect', () => {
        consecutiveFailures = 0;
        if (circuitOpen) {
          circuitOpen = false;
          console.info('[CACHE] Circuit breaker reset - connection restored');
        }
      });
    } catch (error) {
      console.error('[CACHE] Initialization error:', error);
      throw new CacheError(CACHE_ERRORS.CACHE_CONNECT_ERROR, { originalError: error });
    }
  }

  /**
   * Sets a value in cache with type safety and monitoring
   * 
   * @param key - The key to store the value under
   * @param value - The value to store (will be JSON serialized)
   * @param ttl - Optional TTL in seconds (overrides default)
   * @returns Promise that resolves when value is successfully set
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Validate key and value
    if (!key) {
      throw new CacheError('Cache key cannot be empty');
    }

    try {
      // Update metrics for set operation
      this.metrics.operations.set++;
      
      // Serialize value to JSON with type checking
      const serializedValue = JSON.stringify(value);
      
      // Set key-value pair in Redis with error handling
      // Apply TTL with fallback to default
      await this.client.setex(key, ttl || this.defaultTTL, serializedValue);
      
      // Log operation completion
      console.debug(`[CACHE] Set: ${key} (TTL: ${ttl || this.defaultTTL}s)`);
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      console.error(`[CACHE] Error setting key ${key}:`, error);
      throw new CacheError(CACHE_ERRORS.CACHE_ERROR, { 
        key, 
        operation: 'set',
        originalError: error.message 
      });
    }
  }

  /**
   * Retrieves a typed value from cache with monitoring
   * 
   * @param key - The key to retrieve
   * @returns Type-safe cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    // Check connection health
    if (!this.isConnected) {
      throw new CacheError(CACHE_ERRORS.CACHE_CONNECT_ERROR, {
        details: 'Redis connection is not established'
      });
    }

    try {
      // Get value from Redis with error handling
      this.metrics.operations.get++;
      const value = await this.client.get(key);
      
      // Update hit/miss metrics
      if (value === null) {
        this.metrics.misses++;
        console.debug(`[CACHE] Miss: ${key}`);
        return null;
      }
      
      this.metrics.hits++;
      
      // Parse JSON with type validation
      try {
        const parsedValue = JSON.parse(value) as T;
        console.debug(`[CACHE] Hit: ${key}`);
        return parsedValue;
      } catch (parseError) {
        console.error(`[CACHE] JSON parse error for key ${key}:`, parseError);
        // Count as a miss if we can't parse the value
        this.metrics.hits--;
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      console.error(`[CACHE] Error getting key ${key}:`, error);
      throw new CacheError(CACHE_ERRORS.CACHE_ERROR, { 
        key, 
        operation: 'get',
        originalError: error.message 
      });
    }
  }

  /**
   * Removes a value with monitoring
   * 
   * @param key - The key to delete
   * @returns Promise that resolves on successful deletion
   */
  async delete(key: string): Promise<void> {
    // Validate key exists
    if (!key) {
      throw new CacheError('Cache key cannot be empty');
    }

    try {
      // Delete key with error handling
      this.metrics.operations.delete++;
      await this.client.del(key);
      
      // Update deletion metrics
      console.debug(`[CACHE] Deleted: ${key}`);
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      console.error(`[CACHE] Error deleting key ${key}:`, error);
      throw new CacheError(CACHE_ERRORS.CACHE_ERROR, { 
        key, 
        operation: 'delete',
        originalError: error.message 
      });
    }
  }

  /**
   * Clears cache with safety checks
   * 
   * @returns Promise that resolves when cache is cleared
   */
  async clear(): Promise<void> {
    // Verify operation permission
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_CACHE_CLEAR) {
      throw new CacheError('Cache clear operation not allowed in production');
    }

    try {
      // Execute FLUSHALL with safety checks
      await this.client.flushall();
      
      // Reset metrics
      this.metrics = {
        hits: 0,
        misses: 0,
        errors: 0,
        operations: {
          set: 0,
          get: 0,
          delete: 0,
        }
      };
      
      // Log operation completion
      console.info('[CACHE] Cache cleared successfully');
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      console.error('[CACHE] Error clearing cache:', error);
      throw new CacheError(CACHE_ERRORS.CACHE_ERROR, { 
        operation: 'clear',
        originalError: error.message 
      });
    }
  }

  /**
   * Comprehensive health status check
   * 
   * @returns Detailed health status
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    connected: boolean;
    metrics: any;
    memory?: {
      used: string;
      peak: string;
      fragmentation?: string;
    };
    uptime?: number;
    version?: string;
    performance?: {
      hitRate: string;
      operationsPerSecond?: number;
      averageLatency?: number;
    };
  }> {
    try {
      // Check Redis connection
      const pingStart = Date.now();
      const pingPromise = this.client.ping();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ping timeout')), cacheConfig.healthCheck.timeoutMs)
      );
      
      const pingResult = await Promise.race([pingPromise, timeoutPromise]);
      const pingLatency = Date.now() - pingStart;
      const isConnected = pingResult === 'PONG';
      
      // If not connected, return minimal health report
      if (!isConnected) {
        return {
          status: 'error',
          connected: false,
          metrics: this.metrics
        };
      }
      
      // Verify memory usage
      const info = await this.client.info();
      const infoLines = info.split('\r\n');
      
      // Parse memory and system info
      const memory = {
        used: 'unknown',
        peak: 'unknown',
        fragmentation: 'unknown'
      };
      let uptime = 0;
      let version = 'unknown';
      
      for (const line of infoLines) {
        if (line.startsWith('used_memory_human:')) {
          memory.used = line.split(':')[1].trim();
        } else if (line.startsWith('used_memory_peak_human:')) {
          memory.peak = line.split(':')[1].trim();
        } else if (line.startsWith('mem_fragmentation_ratio:')) {
          const ratio = parseFloat(line.split(':')[1]);
          memory.fragmentation = `${ratio.toFixed(2)}x`;
        } else if (line.startsWith('uptime_in_seconds:')) {
          uptime = parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('redis_version:')) {
          version = line.split(':')[1].trim();
        }
      }
      
      // Check error rates
      let status: 'ok' | 'degraded' | 'error' = 'ok';
      const totalOps = this.metrics.operations.get + this.metrics.operations.set + this.metrics.operations.delete;
      
      if (this.metrics.errors > 0) {
        const errorRate = (this.metrics.errors / Math.max(totalOps, 1)) * 100;
        const errorRecency = Date.now() - (this.metrics.lastError?.timestamp || 0);
        
        // Error in the last minute or high error rate is degraded
        if (errorRecency < 60 * 1000 || errorRate > 5) {
          status = 'degraded';
        }
        
        // Very high error rate is error
        if (errorRate > 20) {
          status = 'error';
        }
      }
      
      // Collect performance metrics
      const totalReads = this.metrics.hits + this.metrics.misses;
      const hitRate = totalReads > 0 ? (this.metrics.hits / totalReads) * 100 : 0;
      
      // Calculate operations per second based on uptime (approximation)
      const operationsPerSecond = uptime > 0 ? totalOps / uptime : 0;
      
      // Return health report
      return {
        status,
        connected: true,
        metrics: this.metrics,
        memory,
        uptime,
        version,
        performance: {
          hitRate: `${hitRate.toFixed(2)}%`,
          operationsPerSecond: parseFloat(operationsPerSecond.toFixed(2)),
          averageLatency: pingLatency
        }
      };
    } catch (error) {
      console.error('[CACHE] Health check error:', error);
      return {
        status: 'error',
        connected: false,
        metrics: this.metrics
      };
    }
  }
}