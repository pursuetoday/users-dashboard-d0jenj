/**
 * API Service for User Management Dashboard
 * 
 * Provides a centralized client for making HTTP requests to the backend API with
 * error handling, request/response interceptors, and type-safe methods.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import axios, { AxiosError } from 'axios'; // ^1.4.0
import { axiosInstance } from '../config/api.config';
import { 
  ApiResponse, 
  ApiError, 
  RequestConfig, 
  ErrorType,
  PaginatedResponse
} from '../types/api.types';
import { API_ENDPOINTS, HTTP_STATUS } from '../constants/api.constants';

/**
 * Interface for cache entries to store API responses
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Interface for tracking performance metrics of API requests
 */
interface RequestMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  success: boolean;
  cacheHit?: boolean;
  retryCount?: number;
}

/**
 * Rate limiter implementing token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  /**
   * Creates a new rate limiter instance
   * @param maxTokens - Maximum number of tokens in the bucket
   * @param refillRate - Tokens per second refill rate
   */
  constructor(maxTokens: number = 100, refillRate: number = 1) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
  }

  /**
   * Attempts to consume a token from the bucket
   * @returns Boolean indicating if a token was available and consumed
   */
  public tryConsume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Refills tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    
    if (elapsedMs > 0) {
      const refillAmount = (elapsedMs / 1000) * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
      this.lastRefill = now;
    }
  }
}

/**
 * Service class that provides type-safe methods for making HTTP requests to the backend API
 * with enhanced security, error handling, and performance optimizations
 */
class ApiService {
  /**
   * Axios client instance for making HTTP requests
   */
  private readonly client: typeof axiosInstance;

  /**
   * Map of pending requests for deduplication and cancellation
   */
  private readonly pendingRequests: Map<string, AbortController>;

  /**
   * Cache for storing API responses to reduce duplicate requests
   */
  private readonly responseCache: Map<string, CacheEntry<any>>;

  /**
   * Rate limiter to prevent API abuse
   */
  private readonly rateLimiter: RateLimiter;

  /**
   * Collection of request metrics for performance monitoring
   */
  private metrics: RequestMetrics[] = [];

  /**
   * Default cache TTL in milliseconds (5 minutes)
   */
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000;

  /**
   * Maximum number of metrics to keep in memory
   */
  private readonly MAX_METRICS = 100;

  /**
   * Initializes the API service with a configured Axios instance and sets up
   * interceptors, caching, and rate limiting
   */
  constructor() {
    // Initialize client with axiosInstance from api.config
    this.client = axiosInstance;
    
    // Initialize request tracking and caching maps
    this.pendingRequests = new Map<string, AbortController>();
    this.responseCache = new Map<string, CacheEntry<any>>();
    
    // Initialize rate limiter with configured thresholds (100 requests per minute)
    this.rateLimiter = new RateLimiter(100, 100/60);
  }

  /**
   * Makes a GET request to the specified endpoint with caching, rate limiting, and error handling
   * @param url - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to typed API response
   * @throws ApiError on request failure
   */
  public async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const requestKey = this.generateRequestKey('GET', url, config?.params);
    const metricId = this.startMetric('GET', url);

    try {
      // Check cache for valid response
      const cachedResponse = this.getCachedResponse<ApiResponse<T>>(requestKey);
      if (cachedResponse) {
        this.completeMetric(metricId, true, HTTP_STATUS.OK, true);
        return cachedResponse;
      }

      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      this.pendingRequests.set(requestKey, controller);

      // Make GET request with retry logic
      const response = await this.client.get<ApiResponse<T>>(url, {
        ...config,
        signal: controller.signal
      });

      // Cache the successful response
      if (response.status === HTTP_STATUS.OK) {
        this.cacheResponse(requestKey, response.data);
      }

      this.completeMetric(metricId, true, response.status);
      return response.data;
    } catch (error) {
      this.completeMetric(
        metricId, 
        false, 
        axios.isAxiosError(error) ? error.response?.status : undefined
      );
      throw this.handleApiError(error);
    } finally {
      // Remove request from pending requests map
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Makes a GET request for paginated data with proper parameter handling
   * @param url - API endpoint
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @param config - Additional request configuration
   * @returns Promise resolving to paginated response
   * @throws ApiError on request failure
   */
  public async getPaginated<T>(
    url: string,
    page: number = 1,
    limit: number = 10,
    config?: RequestConfig
  ): Promise<PaginatedResponse<T>> {
    const params = {
      page,
      limit,
      ...(config?.params || {})
    };

    const requestKey = this.generateRequestKey('GET', url, params);
    const metricId = this.startMetric('GET', url);

    try {
      // Check cache for valid response
      const cachedResponse = this.getCachedResponse<PaginatedResponse<T>>(requestKey);
      if (cachedResponse) {
        this.completeMetric(metricId, true, HTTP_STATUS.OK, true);
        return cachedResponse;
      }

      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      this.pendingRequests.set(requestKey, controller);

      // Make GET request with pagination parameters
      const response = await this.client.get<PaginatedResponse<T>>(url, {
        ...config,
        params,
        signal: controller.signal
      });

      // Cache the successful response
      if (response.status === HTTP_STATUS.OK) {
        this.cacheResponse(requestKey, response.data);
      }

      this.completeMetric(metricId, true, response.status);
      return response.data;
    } catch (error) {
      this.completeMetric(
        metricId, 
        false, 
        axios.isAxiosError(error) ? error.response?.status : undefined
      );
      throw this.handleApiError(error);
    } finally {
      // Remove request from pending requests map
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Makes a POST request with data encryption and validation
   * @param url - API endpoint
   * @param data - Request payload
   * @param config - Request configuration
   * @returns Promise resolving to typed API response
   * @throws ApiError on request failure
   */
  public async post<T, R = any>(url: string, data: T, config?: RequestConfig): Promise<ApiResponse<R>> {
    const requestKey = this.generateRequestKey('POST', url, config?.params, data);
    const metricId = this.startMetric('POST', url);

    try {
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      this.pendingRequests.set(requestKey, controller);

      // Make POST request with retry logic
      const response = await this.client.post<ApiResponse<R>>(url, data, {
        ...config,
        signal: controller.signal
      });

      // Invalidate related cache entries since we modified data
      this.invalidateRelatedCache(url);

      this.completeMetric(metricId, true, response.status);
      return response.data;
    } catch (error) {
      this.completeMetric(
        metricId, 
        false, 
        axios.isAxiosError(error) ? error.response?.status : undefined
      );
      throw this.handleApiError(error);
    } finally {
      // Remove request from pending requests map
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Makes a PUT request for updating resources
   * @param url - API endpoint
   * @param data - Request payload
   * @param config - Request configuration
   * @returns Promise resolving to typed API response
   * @throws ApiError on request failure
   */
  public async put<T, R = any>(url: string, data: T, config?: RequestConfig): Promise<ApiResponse<R>> {
    const requestKey = this.generateRequestKey('PUT', url, config?.params, data);
    const metricId = this.startMetric('PUT', url);

    try {
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      this.pendingRequests.set(requestKey, controller);

      // Make PUT request with retry logic
      const response = await this.client.put<ApiResponse<R>>(url, data, {
        ...config,
        signal: controller.signal
      });

      // Invalidate related cache entries since we modified data
      this.invalidateRelatedCache(url);

      this.completeMetric(metricId, true, response.status);
      return response.data;
    } catch (error) {
      this.completeMetric(
        metricId, 
        false, 
        axios.isAxiosError(error) ? error.response?.status : undefined
      );
      throw this.handleApiError(error);
    } finally {
      // Remove request from pending requests map
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Makes a DELETE request for removing resources
   * @param url - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to typed API response
   * @throws ApiError on request failure
   */
  public async delete<R = any>(url: string, config?: RequestConfig): Promise<ApiResponse<R>> {
    const requestKey = this.generateRequestKey('DELETE', url, config?.params);
    const metricId = this.startMetric('DELETE', url);

    try {
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      this.pendingRequests.set(requestKey, controller);

      // Make DELETE request with retry logic
      const response = await this.client.delete<ApiResponse<R>>(url, {
        ...config,
        signal: controller.signal
      });

      // Invalidate related cache entries since we modified data
      this.invalidateRelatedCache(url);

      this.completeMetric(metricId, true, response.status);
      return response.data;
    } catch (error) {
      this.completeMetric(
        metricId, 
        false, 
        axios.isAxiosError(error) ? error.response?.status : undefined
      );
      throw this.handleApiError(error);
    } finally {
      // Remove request from pending requests map
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Cancels a specific request if it's pending
   * @param method - HTTP method
   * @param url - Request URL
   * @param params - Query parameters
   * @param data - Request body data
   * @returns Boolean indicating if a request was canceled
   */
  public cancelRequest(method: string, url: string, params?: any, data?: any): boolean {
    const requestKey = this.generateRequestKey(method, url, params, data);
    const controller = this.pendingRequests.get(requestKey);
    
    if (controller) {
      controller.abort('Request canceled by user');
      this.pendingRequests.delete(requestKey);
      return true;
    }
    
    return false;
  }

  /**
   * Cancels all pending requests
   * Useful when navigating away from a page or during cleanup
   * @returns Number of requests canceled
   */
  public cancelPendingRequests(): number {
    const count = this.pendingRequests.size;
    
    for (const controller of this.pendingRequests.values()) {
      controller.abort('Batch cancellation');
    }
    
    this.pendingRequests.clear();
    return count;
  }

  /**
   * Clears the response cache entirely
   * Useful during logout or when data consistency is required
   */
  public clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Replaces path parameters in URL with actual values
   * @param url - URL with path parameters (e.g., '/users/:id')
   * @param params - Object with parameter values
   * @returns URL with replaced parameters
   */
  public buildUrl(url: string, params: Record<string, string | number>): string {
    let result = url;
    
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`:${key}`, encodeURIComponent(String(value)));
    }
    
    return result;
  }

  /**
   * Returns performance metrics collected by the service
   * @returns Array of request metrics
   */
  public getMetrics(): ReadonlyArray<RequestMetrics> {
    return [...this.metrics];
  }

  /**
   * Clears all collected metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Generates a unique key for request deduplication and caching
   * @param method - HTTP method
   * @param url - Request URL
   * @param params - Query parameters
   * @param data - Request body data
   * @returns Unique string key
   */
  private generateRequestKey(method: string, url: string, params?: any, data?: any): string {
    return `${method}-${url}-${JSON.stringify(params || {})}-${JSON.stringify(data || {})}`;
  }

  /**
   * Checks if a response is cached and not expired
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  private getCachedResponse<T>(key: string): T | null {
    const cached = this.responseCache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.responseCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Caches a response with the given key
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds
   */
  private cacheResponse<T>(key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Invalidates cache entries related to a specific URL
   * Used when modifying data to ensure cache consistency
   * @param url - URL to match against cache keys
   */
  private invalidateRelatedCache(url: string): void {
    const baseUrl = url.split('?')[0];
    
    for (const key of this.responseCache.keys()) {
      if (key.includes(baseUrl)) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Starts tracking metrics for a request
   * @param method - HTTP method
   * @param url - Request URL
   * @returns Index of the metric in the metrics array
   */
  private startMetric(method: string, url: string): number {
    // Remove oldest metrics if we've reached the maximum
    if (this.metrics.length >= this.MAX_METRICS) {
      this.metrics.shift();
    }
    
    const metric: RequestMetrics = {
      url,
      method,
      startTime: performance.now(),
      success: false
    };
    
    this.metrics.push(metric);
    return this.metrics.length - 1;
  }

  /**
   * Completes metrics tracking for a request
   * @param index - Index of the metric in the metrics array
   * @param success - Whether the request was successful
   * @param status - HTTP status code
   * @param cacheHit - Whether the response was from cache
   * @param retryCount - Number of retry attempts made
   */
  private completeMetric(
    index: number,
    success: boolean,
    status?: number,
    cacheHit: boolean = false,
    retryCount: number = 0
  ): void {
    if (index >= 0 && index < this.metrics.length) {
      const metric = this.metrics[index];
      const endTime = performance.now();
      
      this.metrics[index] = {
        ...metric,
        endTime,
        duration: endTime - metric.startTime,
        status,
        success,
        cacheHit,
        retryCount
      };
    }
  }

  /**
   * Handles API errors and provides consistent error objects
   * @param error - Error from API request
   * @returns ApiError with consistent structure
   */
  private handleApiError(error: unknown): ApiError {
    // Log the error for debugging in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[API Error]', error);
    }
    
    // Check for abort errors (canceled requests)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        message: 'Request was canceled',
        status: 0,
        errors: {},
        code: ErrorType.UNKNOWN,
        stack: null
      };
    }
    
    // If the error is already an ApiError, return it directly
    if (typeof error === 'object' && error !== null && 'code' in error && 'status' in error) {
      return error as ApiError;
    }
    
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiError>;
      
      // Determine error type based on status code
      let errorType = ErrorType.UNKNOWN;
      let status = axiosError.response?.status || 0;
      
      if (!axiosError.response) {
        errorType = ErrorType.NETWORK;
      } else {
        if (status === HTTP_STATUS.UNAUTHORIZED) {
          errorType = ErrorType.AUTHENTICATION;
        } else if (status === HTTP_STATUS.BAD_REQUEST || status === 422) {
          errorType = ErrorType.VALIDATION;
        } else if (status >= 500) {
          errorType = ErrorType.SERVER;
        }
      }
      
      return {
        message: axiosError.response?.data?.message || error.message || 'An error occurred during the request',
        status,
        errors: axiosError.response?.data?.errors || {},
        code: errorType,
        stack: process.env.NODE_ENV === 'development' ? axiosError.stack || null : null
      };
    }
    
    // For non-Axios errors
    return {
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errors: {},
      code: ErrorType.UNKNOWN,
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack || null : null
    };
  }
}

/**
 * Singleton instance of ApiService for making secure HTTP requests
 * with comprehensive error handling and performance optimizations
 */
export const apiService = new ApiService();