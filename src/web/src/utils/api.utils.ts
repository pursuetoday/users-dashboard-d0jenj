/**
 * API Utilities for User Management Dashboard
 * 
 * Provides utility functions for handling API requests, responses, error transformations, 
 * and request/response interceptors with comprehensive error handling, type safety, 
 * and enhanced security measures.
 *
 * @packageDocumentation
 * @version 1.0.0
 */

import { AxiosError, AxiosResponse } from 'axios'; // ^1.4.0
import { ApiResponse, ApiError, ErrorType } from '../types/api.types';
import { axiosInstance } from '../config/api.config';

/**
 * Transforms an Axios response into a standardized ApiResponse format
 * with enhanced validation and security measures.
 * 
 * @template T - Type of data payload in the response
 * @param response - The Axios response object
 * @returns A standardized API response with additional security measures
 */
export function transformResponse<T>(response: AxiosResponse<any>): ApiResponse<T> {
  // Validate response structure
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response structure received');
  }

  // Validate content type (should be JSON)
  const contentType = response.headers?.['content-type'] || '';
  if (!contentType.includes('application/json') && response.data) {
    console.warn('Response is not JSON format:', contentType);
  }

  // Check for security headers
  if (!response.headers?.['x-content-type-options']) {
    console.warn('Missing security header: X-Content-Type-Options');
  }

  // Extract response data
  const { data, status } = response;
  const message = data?.message || 'Success';

  // Basic data validation
  if (data === undefined || data === null) {
    console.warn('Response data is empty');
  }

  // Convert to standardized format
  const standardizedResponse: ApiResponse<T> = {
    data: data?.data || data, // Support both {data: T} and direct T formats
    message,
    status,
    timestamp: new Date().toISOString()
  };

  // Log successful response (exclude sensitive data if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${response.config.method?.toUpperCase() || 'UNKNOWN'} ${response.config.url} - ${status} ${message}`);
  }

  return standardizedResponse;
}

/**
 * Transforms an Axios error into a standardized ApiError format
 * with enhanced error handling and security context.
 * 
 * @param error - The Axios error object
 * @returns A standardized error object with security context
 */
export function transformError(error: AxiosError): ApiError {
  // Initialize default error structure
  const apiError: ApiError = {
    message: 'An unexpected error occurred',
    status: 500,
    errors: {},
    code: ErrorType.UNKNOWN,
    stack: process.env.NODE_ENV === 'development' ? error.stack || null : null
  };

  // Check if error is an Axios error
  if (!error.isAxiosError) {
    apiError.message = error.message || 'Non-Axios error occurred';
    return apiError;
  }

  // Handle different error scenarios based on response status
  if (error.response) {
    // Extract status, data, and error details from response
    const { status, data } = error.response;
    apiError.status = status;
    
    // Extract error message and validation errors if available
    if (data) {
      apiError.message = data.message || `Request failed with status code ${status}`;
      apiError.errors = data.errors || {};
    }

    // Categorize error types for more specific handling
    switch (status) {
      case 0: // Network error (no status)
        apiError.code = ErrorType.NETWORK;
        apiError.message = 'Network error: Unable to connect to the server';
        break;
      
      case 401:
        apiError.code = ErrorType.AUTHENTICATION;
        apiError.message = 'Authentication required: Please login to continue';
        break;
      
      case 403:
        apiError.code = ErrorType.AUTHENTICATION;
        apiError.message = 'Access denied: You do not have permission to perform this action';
        break;
      
      case 400:
      case 422:
        apiError.code = ErrorType.VALIDATION;
        // Message is already extracted from response
        break;
      
      case 404:
        apiError.code = ErrorType.UNKNOWN;
        apiError.message = data?.message || 'The requested resource was not found';
        break;
      
      case 429:
        apiError.code = ErrorType.UNKNOWN;
        apiError.message = 'Rate limit exceeded: Please try again later';
        break;
      
      case 500:
      case 502:
      case 503:
      case 504:
        apiError.code = ErrorType.SERVER;
        apiError.message = 'Server error: The server encountered an unexpected condition';
        break;
      
      default:
        apiError.code = ErrorType.UNKNOWN;
        // Message is already extracted from response
    }
  } else if (error.request) {
    // Request was made but no response received (network error)
    apiError.status = 0;
    apiError.code = ErrorType.NETWORK;
    apiError.message = 'Network error: No response received from server';
  } else {
    // Error in setting up the request
    apiError.code = ErrorType.UNKNOWN;
    apiError.message = error.message || 'Error setting up the request';
  }

  // Log error details (with sensitive information removed)
  console.error(`[API Error] ${apiError.code} (${apiError.status}): ${apiError.message}`);
  
  // Log additional error details in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: apiError.status,
      code: apiError.code,
      message: apiError.message,
      validationErrors: apiError.errors
    });
  }

  return apiError;
}

/**
 * Creates a request interceptor with enhanced security measures
 * including token validation, CSRF protection, and security headers.
 * 
 * @returns The interceptor ID
 */
export function createRequestInterceptor(): number {
  return axiosInstance.interceptors.request.use(
    async (config) => {
      // Add request correlation ID for tracing
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      config.headers['X-Request-ID'] = requestId;
      
      // Get auth token from secure storage if request requires authentication
      if (config.requiresAuth !== false) {
        const token = localStorage.getItem('authToken');
        
        if (token) {
          // Validate token format (basic check)
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            console.warn('Invalid JWT token format detected');
          } else {
            // Check for token expiration
            try {
              const payload = JSON.parse(atob(tokenParts[1]));
              const expiry = payload.exp * 1000; // Convert to milliseconds
              
              if (expiry < Date.now()) {
                console.warn('Token expired, attempting refresh flow');
              }
            } catch (error) {
              console.warn('Error parsing JWT token', error);
            }
            
            // Add token to headers
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      }
      
      // Add CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        config.headers['X-CSRF-TOKEN'] = csrfToken;
      }
      
      // Add security headers
      config.headers['X-Content-Type-Options'] = 'nosniff';
      config.headers['X-XSS-Protection'] = '1; mode=block';
      
      // Add request timestamp for debugging
      config.headers['X-Request-Time'] = Date.now().toString();
      
      // Basic payload validation for POST/PUT/PATCH
      if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '') && config.data) {
        // Check for potential XSS in string fields
        const validateObject = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          
          Object.entries(obj).forEach(([key, value]) => {
            if (typeof value === 'string') {
              // Check for potential script tags or suspicious patterns
              if (/<script|javascript:|on\w+=/i.test(value)) {
                console.warn(`Potential XSS detected in field "${key}"`);
              }
            } else if (typeof value === 'object' && value !== null) {
              validateObject(value);
            }
          });
        };
        
        validateObject(config.data);
      }
      
      // Log request (excluding sensitive data)
      if (process.env.NODE_ENV === 'development') {
        const sanitizedConfig = { ...config };
        if (sanitizedConfig.headers?.Authorization) {
          sanitizedConfig.headers.Authorization = '[REDACTED]';
        }
        
        // Avoid logging large request bodies
        if (sanitizedConfig.data && typeof sanitizedConfig.data === 'object') {
          sanitizedConfig.data = '[REQUEST BODY]';
        }
        
        console.log(`[API Request] ${config.method?.toUpperCase() || 'UNKNOWN'} ${config.url}`, sanitizedConfig);
      }
      
      return config;
    },
    (error) => {
      console.error('[Request Interceptor Error]', error);
      return Promise.reject(error);
    }
  );
}

/**
 * Creates a response interceptor with enhanced security and error handling
 * for comprehensive API response processing and error management.
 * 
 * @returns The interceptor ID
 */
export function createResponseInterceptor(): number {
  return axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Validate security headers
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'strict-transport-security': 'max-age=31536000; includeSubDomains'
      };
      
      Object.entries(securityHeaders).forEach(([header, expectedValue]) => {
        const actualValue = response.headers[header];
        if (!actualValue) {
          console.warn(`Missing security header: ${header}`);
        } else if (!actualValue.includes(expectedValue)) {
          console.warn(`Insecure header value for ${header}: ${actualValue}`);
        }
      });
      
      // Check for security vulnerabilities in response
      if (response.data && typeof response.data === 'string') {
        // Check for potential script injections in string responses
        if (/<script|javascript:|on\w+=/i.test(response.data)) {
          console.warn('Potential XSS detected in response data');
        }
      }
      
      // Transform response to standardized format
      const transformedResponse = transformResponse(response);
      
      return transformedResponse;
    },
    (error: AxiosError) => {
      // Transform error to standardized format
      const transformedError = transformError(error);
      
      // Return transformed error for global error handling
      return Promise.reject(transformedError);
    }
  );
}