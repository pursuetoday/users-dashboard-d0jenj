/**
 * Core configuration interfaces for the User Management Dashboard
 * Provides type-safe configuration objects for system components including 
 * authentication, database, caching, and other infrastructure settings
 */

/**
 * Authentication configuration interface with JWT settings and password security options
 */
export interface AuthConfig {
  /** Secret key used for signing JWT tokens */
  jwtSecret: string;
  /** Access token expiration time (e.g., '15m', '1h') */
  accessTokenExpiration: string;
  /** Refresh token expiration time (e.g., '7d', '30d') */
  refreshTokenExpiration: string;
  /** Number of bcrypt hashing rounds for password encryption (recommended: 12+) */
  passwordHashRounds: number;
  /** JWT issuer name for token generation */
  tokenIssuer: string;
  /** Allowed audiences for JWT tokens */
  tokenAudience: string[];
}

/**
 * Database configuration interface for PostgreSQL with connection pooling and replication options
 */
export interface DatabaseConfig {
  /** PostgreSQL connection URL or connection string */
  url: string;
  /** Connection pool configuration */
  pool: {
    /** Minimum number of connections in pool */
    min: number;
    /** Maximum number of connections in pool */
    max: number;
    /** Connection idle timeout in milliseconds */
    idleTimeoutMillis: number;
  };
  /** SSL configuration for secure database connections */
  ssl: {
    /** Whether to enable SSL */
    enabled: boolean;
    /** Whether to reject unauthorized certificates */
    rejectUnauthorized: boolean;
    /** Path to CA certificate file (optional) */
    ca?: string;
  };
  /** Database replication configuration for read replicas */
  replication: {
    /** Whether to enable read-write splitting */
    enabled: boolean;
    /** Master database for write operations */
    master?: {
      /** Connection URL for master database */
      url: string;
    };
    /** Read replicas for read operations */
    slaves?: Array<{
      /** Connection URL for slave database */
      url: string;
    }>;
  };
  /** Whether to enable query logging */
  logging: boolean;
}

/**
 * Cache configuration interface for Redis with cluster and retry options
 */
export interface CacheConfig {
  /** Redis connection URL */
  url: string;
  /** Default cache TTL in seconds */
  ttl: number;
  /** Redis cluster configuration */
  cluster: {
    /** Whether to enable cluster mode */
    enabled: boolean;
    /** List of cluster nodes */
    nodes?: string[];
    /** Maximum number of redirections */
    maxRedirections?: number;
  };
  /** Retry strategy for connection failures */
  retryStrategy: {
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Retry delay in milliseconds */
    delay: number;
    /** Whether to use exponential backoff */
    exponentialBackoff: boolean;
  };
}

/**
 * Logger configuration interface with file output and rotation options
 */
export interface LoggerConfig {
  /** Log level ('debug', 'info', 'warn', 'error') */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Log format string or template */
  format: string;
  /** File logging configuration */
  file: {
    /** Whether to enable file logging */
    enabled: boolean;
    /** Path to log file */
    path: string;
  };
  /** Log rotation configuration */
  rotation: {
    /** Whether to enable log rotation */
    enabled: boolean;
    /** Maximum file size before rotation */
    maxSize: string;
    /** Maximum number of rotated files to keep */
    maxFiles: number;
    /** Whether to compress rotated logs */
    compress: boolean;
  };
}

/**
 * Rate limiting configuration interface with whitelisting options
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests within the window */
  max: number;
  /** Whether to skip failed requests in the count */
  skipFailedRequests: boolean;
  /** IP addresses to whitelist from rate limiting */
  whitelist: string[];
}

/**
 * CORS configuration interface with security options
 */
export interface CorsConfig {
  /** Allowed origins (string for single origin, array for multiple) */
  origin: string | string[];
  /** Allowed HTTP methods */
  methods: string[];
  /** Whether to allow credentials */
  credentials: boolean;
  /** Headers exposed to the client */
  exposedHeaders: string[];
  /** Preflight request cache time in seconds */
  maxAge: number;
}

/**
 * Main application configuration interface combining all component configurations
 * with additional validation and environment support
 */
export interface Config {
  /** Authentication configuration */
  auth: AuthConfig;
  /** Database configuration */
  database: DatabaseConfig;
  /** Cache configuration */
  cache: CacheConfig;
  /** Logger configuration */
  logger: LoggerConfig;
  /** Rate limit configuration */
  rateLimit: RateLimitConfig;
  /** CORS configuration */
  cors: CorsConfig;
  /** Current environment ('development', 'test', 'production') */
  env: string;
  /** Whether the application is running in production mode */
  isProduction: boolean;
}