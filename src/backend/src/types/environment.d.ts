/**
 * Environment Variables Declaration
 * 
 * This file extends the NodeJS.ProcessEnv interface to define strongly-typed
 * environment variables used throughout the application. This ensures type safety
 * and proper configuration management.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * Application environment mode
     * @example 'development', 'production', 'test'
     */
    NODE_ENV: 'development' | 'production' | 'test';
    
    /**
     * Server port number
     * @example '3000'
     */
    PORT: string;
    
    /**
     * PostgreSQL database connection string
     * @example 'postgresql://username:password@localhost:5432/dbname'
     */
    DATABASE_URL: string;
    
    /**
     * Minimum number of connections in the database pool
     * @example '2'
     */
    DATABASE_POOL_MIN: string;
    
    /**
     * Maximum number of connections in the database pool
     * @example '10'
     */
    DATABASE_POOL_MAX: string;
    
    /**
     * Redis connection string for caching and session management
     * @example 'redis://localhost:6379'
     */
    REDIS_URL: string;
    
    /**
     * Redis cache TTL in seconds
     * @example '3600'
     */
    REDIS_TTL: string;
    
    /**
     * Secret key for JWT token generation and validation
     */
    JWT_SECRET: string;
    
    /**
     * JWT access token expiration time in seconds
     * @example '900' (15 minutes)
     */
    JWT_ACCESS_EXPIRATION: string;
    
    /**
     * JWT refresh token expiration time in seconds
     * @example '604800' (7 days)
     */
    JWT_REFRESH_EXPIRATION: string;
    
    /**
     * CORS allowed origins, comma-separated for multiple origins
     * @example 'http://localhost:3000,https://example.com'
     */
    CORS_ORIGIN: string;
    
    /**
     * Rate limiting window in milliseconds
     * @example '60000' (1 minute)
     */
    RATE_LIMIT_WINDOW_MS: string;
    
    /**
     * Maximum number of requests allowed in the rate limit window
     * @example '100'
     */
    RATE_LIMIT_MAX_REQUESTS: string;
    
    /**
     * Application logging level
     * @example 'error', 'warn', 'info', 'debug'
     */
    LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  }
}