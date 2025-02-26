/**
 * API Configuration for User Management Dashboard
 * 
 * Configures the API client settings and default request configurations for the 
 * frontend application's communication with the backend API, including enhanced
 * security measures, error handling, and performance optimizations.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios'; // ^1.4.0
import { RequestConfig, ApiResponse, ApiError, ErrorType } from '../types/api.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// Global constants
const VITE_API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Default API configuration
 * Contains base URL, timeout, headers, and other request settings
 */
const defaultConfig: Partial<RequestConfig> = {
  baseURL: VITE_API_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': '{{csrf_token}}' // Will be replaced with actual token
  },
  withCredentials: true,
  params: {},
  requiresAuth: true,
  retryAttempts: MAX_RETRY_ATTEMPTS,
  retryDelay: RETRY_DELAY
};

/**
 * Rate limiting configuration
 * Implements token bucket algorithm to control request rate
 */
const rateLimitConfig = {
  maxRequests: 100,
  perMinute: 60000,
  tokenBucketSize: 100,
  tokenRefillRate: 60
};

/**
 * Retry configuration for failed requests
 * Specifies which status codes should trigger retry and related settings
 */
const retryConfig = {
  maxRetries: MAX_RETRY_ATTEMPTS,
  retryDelay: RETRY_DELAY,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

// Token bucket for rate limiting
let tokenBucket = {
  tokens: rateLimitConfig.tokenBucketSize,
  lastRefill: Date.now()
};

// For request deduplication
const pendingRequests = new Map();

// For response caching
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const requestCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Flag to prevent multiple token refresh requests
let isRefreshing = false;
// Queue of requests waiting for token refresh
let refreshQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

/**
 * Process the queue of requests that were waiting for token refresh
 * @param token - New token to use for the queued requests
 * @param error - Error if token refresh failed
 */
function processRefreshQueue(token: string | null, error: any = null): void {
  refreshQueue.forEach(request => {
    if (error) {
      request.reject(error);
    } else {
      request.resolve(token);
    }
  });
  
  // Reset the queue
  refreshQueue = [];
}

/**
 * Checks if a JWT token is about to expire
 * @param token - JWT token to check
 * @returns boolean indicating if token expires in less than 5 minutes
 */
function isTokenExpiringSoon(token: string): boolean {
  try {
    // Decode JWT to get expiration
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const { exp } = JSON.parse(jsonPayload);
    
    // If token expires in less than 5 minutes, consider it expiring soon
    return exp * 1000 < Date.now() + 5 * 60 * 1000;
  } catch (e) {
    // If we can't decode the token, assume it's valid
    return false;
  }
}

/**
 * Check if we have enough tokens in the bucket for a request
 * Implements token bucket algorithm for client-side rate limiting
 * @returns boolean indicating if request can proceed
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  const elapsedMs = now - tokenBucket.lastRefill;
  
  // Refill tokens based on elapsed time
  if (elapsedMs > 0) {
    const refillAmount = Math.floor(elapsedMs * (rateLimitConfig.tokenRefillRate / rateLimitConfig.perMinute));
    
    tokenBucket.tokens = Math.min(
      rateLimitConfig.tokenBucketSize,
      tokenBucket.tokens + refillAmount
    );
    tokenBucket.lastRefill = now;
  }
  
  // Check if we have a token available
  if (tokenBucket.tokens >= 1) {
    tokenBucket.tokens -= 1;
    return true;
  }
  
  return false;
}

/**
 * Get cached response if available and not expired
 * @param key - Cache key
 * @returns Cached data or null if not found/expired
 */
function getCachedResponse(key: string): any | null {
  const cached = requestCache.get(key);
  
  if (!cached) {
    return null;
  }
  
  // Check if cache entry has expired
  if (Date.now() - cached.timestamp > cached.ttl) {
    requestCache.delete(key);
    return null;
  }
  
  return cached.data;
}

/**
 * Cache a response with the given key
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds
 */
function cacheResponse(key: string, data: any, ttl: number = CACHE_TTL): void {
  requestCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Attempts to refresh the authentication token
 * @returns Promise that resolves with new token or rejects with error
 */
async function refreshAuthToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    // Create a new axios instance without interceptors to prevent infinite loop
    const tokenRefreshInstance = axios.create({
      baseURL: VITE_API_URL,
      timeout: DEFAULT_TIMEOUT
    });
    
    const response = await tokenRefreshInstance.post(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      { refreshToken }
    );
    
    const { token, refreshToken: newRefreshToken } = response.data;
    
    // Store new tokens
    localStorage.setItem('authToken', token);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    return token;
  } catch (error) {
    // If refresh fails, force logout
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    
    // Redirect to login page
    window.location.href = '/login';
    
    throw error;
  }
}

/**
 * Creates and configures an Axios instance with enhanced security, error handling, and performance optimizations
 * @param config - Request configuration options
 * @returns Configured Axios instance for making API requests
 */
function createAxiosInstance(config: Partial<RequestConfig> = {}): AxiosInstance {
  // Create new instance with merged config
  const instance = axios.create({
    ...defaultConfig,
    ...config
  });
  
  // Set up request and response interceptors
  setupRequestInterceptor(instance);
  setupResponseInterceptor(instance);
  
  return instance;
}

/**
 * Configures request interceptors for authentication, validation, and security
 * @param instance - Axios instance to configure
 */
function setupRequestInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use(
    async (config) => {
      // Add request ID for tracing
      const requestId = Math.random().toString(36).substring(2, 15);
      config.headers['X-Request-ID'] = requestId;
      
      // Generate request key for deduplication
      const requestKey = `${config.method}-${config.url}-${JSON.stringify(config.params)}-${JSON.stringify(config.data)}`;
      
      // Check for duplicate in-flight requests
      if (pendingRequests.has(requestKey)) {
        const controller = new AbortController();
        config.signal = controller.signal;
        controller.abort('Duplicate request canceled');
      }
      
      // Store this request in pending requests
      const controller = new AbortController();
      config.signal = controller.signal;
      pendingRequests.set(requestKey, controller);
      
      // For GET requests, check cache first
      if (config.method?.toLowerCase() === 'get') {
        const cached = getCachedResponse(requestKey);
        
        if (cached) {
          controller.abort('Using cached response');
          config.cachedResponse = cached;
        }
      }
      
      // Apply rate limiting
      if (!checkRateLimit()) {
        controller.abort('Rate limit exceeded');
        throw new Error('Rate limit exceeded');
      }
      
      // Add authentication token if required
      if (config.requiresAuth) {
        const token = localStorage.getItem('authToken');
        
        if (token) {
          // Check if token is about to expire
          if (isTokenExpiringSoon(token)) {
            // Don't refresh if already refreshing
            if (!isRefreshing) {
              isRefreshing = true;
              
              try {
                const newToken = await refreshAuthToken();
                // Update config with new token
                config.headers['Authorization'] = `Bearer ${newToken}`;
                // Process the queue of waiting requests
                processRefreshQueue(newToken);
              } catch (error) {
                processRefreshQueue(null, error);
                throw error;
              } finally {
                isRefreshing = false;
              }
            } else {
              // Wait for current refresh to complete
              try {
                const newToken = await new Promise((resolve, reject) => {
                  refreshQueue.push({ resolve, reject });
                });
                config.headers['Authorization'] = `Bearer ${newToken}`;
              } catch (error) {
                throw error;
              }
            }
          } else {
            // Token is still valid
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      }
      
      // Add security headers
      config.headers['X-Content-Type-Options'] = 'nosniff';
      
      // Add CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
}

/**
 * Configures response interceptors for error handling and data processing
 * @param instance - Axios instance to configure
 */
function setupResponseInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Remove from pending requests
      const requestKey = `${response.config.method}-${response.config.url}-${JSON.stringify(response.config.params)}-${JSON.stringify(response.config.data)}`;
      pendingRequests.delete(requestKey);
      
      // Cache successful GET responses
      if (response.config.method?.toLowerCase() === 'get') {
        // Determine TTL - can be provided in response headers or use default
        const ttl = parseInt(response.headers['cache-control']?.match(/max-age=(\d+)/)?.[1] || '0') * 1000 || CACHE_TTL;
        
        cacheResponse(requestKey, response.data, ttl);
      }
      
      return response;
    },
    async (error: AxiosError) => {
      // Handle canceled requests due to cache usage
      if (error.message === 'Using cached response' && error.config?.cachedResponse) {
        return {
          status: 200,
          data: error.config.cachedResponse,
          headers: {},
          config: error.config,
          statusText: 'OK (Cached)'
        };
      }
      
      // Remove from pending requests if applicable
      if (error.config) {
        const requestKey = `${error.config.method}-${error.config.url}-${JSON.stringify(error.config.params)}-${JSON.stringify(error.config.data)}`;
        pendingRequests.delete(requestKey);
      }
      
      // Determine error type for proper handling
      let errorType = ErrorType.UNKNOWN;
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const status = error.response.status;
        
        switch (status) {
          case 401:
            errorType = ErrorType.AUTHENTICATION;
            
            // Handle authentication errors (e.g., redirect to login)
            if (!isRefreshing && !error.config?.skipAuthRefresh) {
              isRefreshing = true;
              
              try {
                // Attempt to refresh the token
                const refreshToken = localStorage.getItem('refreshToken');
                
                if (refreshToken) {
                  const newToken = await refreshAuthToken();
                  
                  // Retry the original request with new token
                  const newConfig = { ...error.config, skipAuthRefresh: true };
                  if (newConfig.headers) {
                    newConfig.headers['Authorization'] = `Bearer ${newToken}`;
                  }
                  
                  // Process queue of waiting requests
                  processRefreshQueue(newToken);
                  
                  return instance(newConfig);
                }
              } catch (refreshError) {
                // Process queue with error
                processRefreshQueue(null, refreshError);
              } finally {
                isRefreshing = false;
              }
            } else if (isRefreshing) {
              // Wait for the current refresh to complete
              try {
                const newToken = await new Promise((resolve, reject) => {
                  refreshQueue.push({ resolve, reject });
                });
                
                // Retry the original request with new token
                const newConfig = { ...error.config, skipAuthRefresh: true };
                if (newConfig.headers) {
                  newConfig.headers['Authorization'] = `Bearer ${newToken}`;
                }
                
                return instance(newConfig);
              } catch (refreshError) {
                return Promise.reject(refreshError);
              }
            }
            break;
          case 400:
          case 422:
            errorType = ErrorType.VALIDATION;
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            errorType = ErrorType.SERVER;
            break;
          default:
            errorType = ErrorType.UNKNOWN;
        }
        
        // Implement retry logic for certain status codes
        if (
          error.config && 
          retryConfig.retryableStatuses.includes(error.response.status) &&
          (!error.config.retryAttempt || error.config.retryAttempt < retryConfig.maxRetries)
        ) {
          // Increment retry attempt
          const retryAttempt = (error.config.retryAttempt || 0) + 1;
          error.config.retryAttempt = retryAttempt;
          
          // Calculate delay with exponential backoff
          const delay = retryConfig.retryDelay * Math.pow(2, retryAttempt - 1);
          
          // Wait for the calculated delay
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          return instance(error.config);
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorType = ErrorType.NETWORK;
      }
      
      // Log error for debugging
      console.error(`[API Error][${errorType}]`, error);
      
      // Enhance error object with additional information
      const enhancedError: ApiError = {
        message: error.message || 'An unexpected error occurred',
        status: error.response?.status || 0,
        errors: error.response?.data?.errors || {},
        code: errorType,
        stack: process.env.NODE_ENV === 'development' ? error.stack || null : null
      };
      
      // Return the enhanced error for global error handling
      return Promise.reject(enhancedError);
    }
  );
}

/**
 * Default API configuration export for application-wide usage
 */
export const apiConfig = {
  baseURL: defaultConfig.baseURL,
  timeout: defaultConfig.timeout,
  headers: defaultConfig.headers,
  withCredentials: defaultConfig.withCredentials
};

/**
 * Preconfigured Axios instance with all security and performance enhancements
 * Ready to use for API requests throughout the application
 */
export const axiosInstance = createAxiosInstance(defaultConfig);

/**
 * Export utility functions for custom instance creation
 */
export { createAxiosInstance };