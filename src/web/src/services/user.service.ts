/**
 * User Service for User Management Dashboard
 * 
 * Provides methods for managing user data through API calls, including CRUD operations,
 * filtering, pagination, caching, and comprehensive error handling.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import { apiService } from './api.service';
import { 
  User, 
  UserFormData, 
  UserRole, 
  UserResponse, 
  UsersResponse, 
  UserFilters 
} from '../types/user.types';
import { ApiError, ErrorType } from '../types/api.types';
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
 * Interface for tracking request metrics
 */
interface RequestMetrics {
  endpoint: string;
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
 * Interface for queued request operations
 */
interface QueuedOperation<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

/**
 * Service class that handles all user-related API operations with enhanced
 * error handling, caching, and validation
 */
class UserService {
  /**
   * Cache for storing API responses
   */
  private cache: Map<string, CacheEntry<any>>;
  
  /**
   * Map of pending requests for deduplication
   */
  private requestQueue: Map<string, Promise<any>>;
  
  /**
   * Rate limiter implementation
   */
  private rateLimiter: {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number;
    tryConsume: () => boolean;
  };
  
  /**
   * Array to store request metrics for performance monitoring
   */
  private metrics: RequestMetrics[] = [];
  
  /**
   * Default cache TTL in milliseconds (5 minutes)
   */
  private readonly CACHE_TTL = 5 * 60 * 1000;
  
  /**
   * Maximum number of metrics to keep in memory
   */
  private readonly MAX_METRICS = 100;
  
  /**
   * Initializes the UserService with caching and rate limiting capabilities
   */
  constructor() {
    // Initialize cache storage for user data
    this.cache = new Map();
    
    // Setup request queue for bulk operations
    this.requestQueue = new Map();
    
    // Configure rate limiter (100 requests/minute)
    const maxTokens = 100;
    const refillRate = 100 / 60; // Tokens per second
    this.rateLimiter = {
      tokens: maxTokens,
      lastRefill: Date.now(),
      maxTokens,
      refillRate,
      tryConsume: () => {
        this.refillTokens();
        if (this.rateLimiter.tokens >= 1) {
          this.rateLimiter.tokens -= 1;
          return true;
        }
        return false;
      }
    };
  }
  
  /**
   * Refills tokens in the rate limiter based on elapsed time
   * @private
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.rateLimiter.lastRefill;
    
    if (elapsedMs > 0) {
      const refillAmount = (elapsedMs / 1000) * this.rateLimiter.refillRate;
      this.rateLimiter.tokens = Math.min(
        this.rateLimiter.maxTokens,
        this.rateLimiter.tokens + refillAmount
      );
      this.rateLimiter.lastRefill = now;
    }
  }
  
  /**
   * Generates a unique cache key for requests
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param params - Query parameters or request body
   * @returns Unique string key for caching
   * @private
   */
  private generateCacheKey(method: string, endpoint: string, params?: any): string {
    return `${method}-${endpoint}-${JSON.stringify(params || {})}`;
  }
  
  /**
   * Retrieves data from cache if available and not expired
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   * @private
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache has expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Stores data in cache with expiration
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds
   * @private
   */
  private addToCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Invalidates cache entries related to a specific endpoint
   * Used when data is modified to ensure cache consistency
   * @param endpoint - API endpoint to match against cache keys
   * @private
   */
  private invalidateCache(endpoint: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(endpoint)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Validates user ID format (UUID)
   * @param id - User ID to validate
   * @returns Boolean indicating if ID is valid
   * @private
   */
  private validateUserId(id: string): boolean {
    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
  
  /**
   * Starts tracking metrics for a request
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @returns Index of the metric in the array
   * @private
   */
  private startMetric(method: string, endpoint: string): number {
    // Remove oldest metrics if we've reached maximum
    if (this.metrics.length >= this.MAX_METRICS) {
      this.metrics.shift();
    }
    
    const metric: RequestMetrics = {
      endpoint,
      method,
      startTime: performance.now(),
      success: false
    };
    
    this.metrics.push(metric);
    return this.metrics.length - 1;
  }
  
  /**
   * Completes metrics tracking for a request
   * @param index - Index of the metric in the array
   * @param success - Whether the request was successful
   * @param status - HTTP status code
   * @param cacheHit - Whether result was from cache
   * @param retryCount - Number of retry attempts
   * @private
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
   * Retrieves performance metrics collected by the service
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
   * Retrieves a paginated list of users with enhanced filtering and caching
   * @param page - Page number (1-based)
   * @param limit - Number of items per page
   * @param filters - Optional filtering criteria
   * @returns Promise with paginated users response
   */
  public async getUsers(
    page: number = 1,
    limit: number = 10,
    filters?: UserFilters
  ): Promise<UsersResponse> {
    const metricIndex = this.startMetric('GET', API_ENDPOINTS.USERS.BASE);
    
    try {
      // Validate pagination parameters
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 10;
      
      // Prepare request params
      const params: Record<string, any> = {
        page,
        limit,
        ...filters
      };
      
      // Generate cache key
      const cacheKey = this.generateCacheKey('GET', API_ENDPOINTS.USERS.BASE, params);
      
      // Check if request is already in flight (request deduplication)
      if (this.requestQueue.has(cacheKey)) {
        const result = await this.requestQueue.get(cacheKey) as UsersResponse;
        this.completeMetric(metricIndex, true, HTTP_STATUS.OK);
        return result;
      }
      
      // Check cache for existing data
      const cachedData = this.getFromCache<UsersResponse>(cacheKey);
      if (cachedData) {
        this.completeMetric(metricIndex, true, HTTP_STATUS.OK, true);
        return cachedData;
      }
      
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      // Create a new request promise
      const requestPromise = (async () => {
        // Make API request
        const response = await apiService.get<UsersResponse>(
          API_ENDPOINTS.USERS.BASE,
          { params }
        );
        
        // Validate response data
        if (!response.data || !Array.isArray(response.data.data)) {
          throw new Error('Invalid response format from server');
        }
        
        // Cache the result
        this.addToCache(cacheKey, response);
        
        return response;
      })();
      
      // Add to request queue
      this.requestQueue.set(cacheKey, requestPromise);
      
      try {
        // Wait for the request to complete
        const result = await requestPromise;
        this.completeMetric(metricIndex, true, HTTP_STATUS.OK);
        return result;
      } finally {
        // Remove from request queue
        this.requestQueue.delete(cacheKey);
      }
    } catch (error) {
      // Complete metric with failure
      this.completeMetric(metricIndex, false, (error as ApiError).status);
      
      // Handle errors
      console.error('Error fetching users:', error);
      
      if ((error as ApiError).code === ErrorType.AUTHENTICATION) {
        // Handle authentication errors
        window.location.href = '/login';
      }
      
      // Re-throw with enhanced information
      throw error;
    }
  }
  
  /**
   * Retrieves a single user by ID with caching
   * @param id - User ID
   * @returns Promise with user response
   */
  public async getUserById(id: string): Promise<UserResponse> {
    const endpoint = API_ENDPOINTS.USERS.GET_USER.replace(':id', id);
    const metricIndex = this.startMetric('GET', endpoint);
    
    try {
      // Validate user ID
      if (!this.validateUserId(id)) {
        throw new Error('Invalid user ID format');
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey('GET', endpoint);
      
      // Check if request is already in flight (request deduplication)
      if (this.requestQueue.has(cacheKey)) {
        const result = await this.requestQueue.get(cacheKey) as UserResponse;
        this.completeMetric(metricIndex, true, HTTP_STATUS.OK);
        return result;
      }
      
      // Check cache for existing data
      const cachedData = this.getFromCache<UserResponse>(cacheKey);
      if (cachedData) {
        this.completeMetric(metricIndex, true, HTTP_STATUS.OK, true);
        return cachedData;
      }
      
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      // Create a new request promise
      const requestPromise = (async () => {
        // Make API request
        const response = await apiService.get<UserResponse>(endpoint);
        
        // Validate response data
        if (!response.data || !response.data.id) {
          throw new Error('Invalid user data received from server');
        }
        
        // Cache the result
        this.addToCache(cacheKey, response);
        
        return response;
      })();
      
      // Add to request queue
      this.requestQueue.set(cacheKey, requestPromise);
      
      try {
        // Wait for the request to complete
        const result = await requestPromise;
        this.completeMetric(metricIndex, true, HTTP_STATUS.OK);
        return result;
      } finally {
        // Remove from request queue
        this.requestQueue.delete(cacheKey);
      }
    } catch (error) {
      // Complete metric with failure
      this.completeMetric(metricIndex, false, (error as ApiError).status);
      
      // Handle errors
      console.error(`Error fetching user ${id}:`, error);
      
      if ((error as ApiError).code === ErrorType.AUTHENTICATION) {
        // Handle authentication errors
        window.location.href = '/login';
      }
      
      // Re-throw with enhanced information
      throw error;
    }
  }
  
  /**
   * Creates a new user with validation
   * @param userData - User form data
   * @returns Promise with the created user response
   */
  public async createUser(userData: UserFormData): Promise<UserResponse> {
    const metricIndex = this.startMetric('POST', API_ENDPOINTS.USERS.CREATE_USER);
    
    try {
      // Validate user data
      this.validateUserData(userData);
      
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      // Make API request
      const response = await apiService.post<UserFormData, UserResponse>(
        API_ENDPOINTS.USERS.CREATE_USER,
        userData
      );
      
      // Invalidate users list in cache
      this.invalidateCache(API_ENDPOINTS.USERS.BASE);
      
      this.completeMetric(metricIndex, true, HTTP_STATUS.CREATED);
      return response;
    } catch (error) {
      // Complete metric with failure
      this.completeMetric(metricIndex, false, (error as ApiError).status);
      
      // Handle errors
      console.error('Error creating user:', error);
      
      if ((error as ApiError).code === ErrorType.AUTHENTICATION) {
        // Handle authentication errors
        window.location.href = '/login';
      }
      
      // Re-throw with enhanced information
      throw error;
    }
  }
  
  /**
   * Updates an existing user with validation
   * @param id - User ID
   * @param userData - Partial user form data
   * @returns Promise with the updated user response
   */
  public async updateUser(id: string, userData: Partial<UserFormData>): Promise<UserResponse> {
    const endpoint = API_ENDPOINTS.USERS.UPDATE_USER.replace(':id', id);
    const metricIndex = this.startMetric('PUT', endpoint);
    
    try {
      // Validate user ID
      if (!this.validateUserId(id)) {
        throw new Error('Invalid user ID format');
      }
      
      // Validate user data
      if (Object.keys(userData).length > 0) {
        this.validateUserData(userData, true);
      } else {
        throw new Error('No data provided for update');
      }
      
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      // Make API request
      const response = await apiService.put<Partial<UserFormData>, UserResponse>(
        endpoint,
        userData
      );
      
      // Invalidate cache for both the users list and this specific user
      this.invalidateCache(API_ENDPOINTS.USERS.BASE);
      this.invalidateCache(endpoint);
      
      this.completeMetric(metricIndex, true, HTTP_STATUS.OK);
      return response;
    } catch (error) {
      // Complete metric with failure
      this.completeMetric(metricIndex, false, (error as ApiError).status);
      
      // Handle errors
      console.error(`Error updating user ${id}:`, error);
      
      if ((error as ApiError).code === ErrorType.AUTHENTICATION) {
        // Handle authentication errors
        window.location.href = '/login';
      }
      
      // Re-throw with enhanced information
      throw error;
    }
  }
  
  /**
   * Deletes a user by ID
   * @param id - User ID
   * @returns Promise resolving to boolean indicating success
   */
  public async deleteUser(id: string): Promise<boolean> {
    const endpoint = API_ENDPOINTS.USERS.DELETE_USER.replace(':id', id);
    const metricIndex = this.startMetric('DELETE', endpoint);
    
    try {
      // Validate user ID
      if (!this.validateUserId(id)) {
        throw new Error('Invalid user ID format');
      }
      
      // Apply rate limiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      // Make API request
      await apiService.delete(endpoint);
      
      // Invalidate cache for both the users list and this specific user
      this.invalidateCache(API_ENDPOINTS.USERS.BASE);
      this.invalidateCache(endpoint);
      
      this.completeMetric(metricIndex, true, HTTP_STATUS.OK);
      return true;
    } catch (error) {
      // Complete metric with failure
      this.completeMetric(metricIndex, false, (error as ApiError).status);
      
      // Handle errors
      console.error(`Error deleting user ${id}:`, error);
      
      if ((error as ApiError).code === ErrorType.AUTHENTICATION) {
        // Handle authentication errors
        window.location.href = '/login';
      }
      
      // If not found, consider it a successful deletion
      if ((error as ApiError).status === HTTP_STATUS.NOT_FOUND) {
        return true;
      }
      
      // Re-throw with enhanced information
      throw error;
    }
  }
  
  /**
   * Validates user data against schema requirements
   * Throws validation error if data is invalid
   * @param userData - User data to validate
   * @param isUpdate - Whether this is an update operation
   * @private
   */
  private validateUserData(userData: Partial<UserFormData>, isUpdate: boolean = false): void {
    const errors: Record<string, string> = {};
    
    // Email validation
    if ('email' in userData) {
      const email = userData.email;
      if (!email && !isUpdate) {
        errors.email = 'Email is required';
      } else if (email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(email)) {
        errors.email = 'Invalid email format';
      } else if (email && email.length > 255) {
        errors.email = 'Email must be less than 255 characters';
      }
    } else if (!isUpdate) {
      errors.email = 'Email is required';
    }
    
    // First name validation
    if ('firstName' in userData) {
      const firstName = userData.firstName;
      if (!firstName && !isUpdate) {
        errors.firstName = 'First name is required';
      } else if (firstName && (firstName.length < 2 || firstName.length > 50)) {
        errors.firstName = 'First name must be between 2 and 50 characters';
      } else if (firstName && !/^[A-Za-z\s]+$/.test(firstName)) {
        errors.firstName = 'First name must contain only letters and spaces';
      }
    } else if (!isUpdate) {
      errors.firstName = 'First name is required';
    }
    
    // Last name validation
    if ('lastName' in userData) {
      const lastName = userData.lastName;
      if (!lastName && !isUpdate) {
        errors.lastName = 'Last name is required';
      } else if (lastName && (lastName.length < 2 || lastName.length > 50)) {
        errors.lastName = 'Last name must be between 2 and 50 characters';
      } else if (lastName && !/^[A-Za-z\s]+$/.test(lastName)) {
        errors.lastName = 'Last name must contain only letters and spaces';
      }
    } else if (!isUpdate) {
      errors.lastName = 'Last name is required';
    }
    
    // Role validation
    if ('role' in userData) {
      const role = userData.role;
      if (!role && !isUpdate) {
        errors.role = 'Role is required';
      } else if (role && !Object.values(UserRole).includes(role)) {
        errors.role = 'Invalid role';
      }
    } else if (!isUpdate) {
      errors.role = 'Role is required';
    }
    
    // Throw validation error if there are any issues
    if (Object.keys(errors).length > 0) {
      const error: ApiError = {
        message: 'Validation failed',
        status: HTTP_STATUS.BAD_REQUEST,
        errors: Object.entries(errors).reduce((acc, [key, value]) => {
          acc[key] = [value];
          return acc;
        }, {} as Record<string, string[]>),
        code: ErrorType.VALIDATION,
        stack: null
      };
      
      throw error;
    }
  }
  
  /**
   * Batch process multiple user operations in sequence
   * @param operations - Array of operations to process
   * @returns Promise resolving to array of results or errors
   */
  public async batchProcess<T>(operations: Array<() => Promise<T>>): Promise<Array<T | Error>> {
    const results: Array<T | Error> = [];
    
    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
      } catch (error) {
        results.push(error as Error);
      }
    }
    
    return results;
  }
  
  /**
   * Clears all cache entries
   * Useful during logout or when data consistency is required
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Singleton instance of UserService with enhanced functionality
 * for managing user data
 */
export const userService = new UserService();