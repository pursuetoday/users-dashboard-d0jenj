/**
 * API Constants for User Management Dashboard
 * Contains API endpoints, configurations, and HTTP status codes for communicating with the backend.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import { HttpMethod } from '../types/api.types';

/**
 * API Version string to be used as a prefix for all API endpoints
 */
const API_VERSION = '/api/v1';

/**
 * Default timeout for API requests in milliseconds (30 seconds)
 */
const API_TIMEOUT = 30000;

/**
 * Object containing all API endpoint paths
 * These paths should be combined with API_VERSION when making requests
 */
export const API_ENDPOINTS = {
  /**
   * Authentication related endpoints
   */
  AUTH: {
    /**
     * Endpoint for user login
     * @method POST
     * @expectedPayload { email: string, password: string }
     */
    LOGIN: '/auth/login',
    
    /**
     * Endpoint for user registration
     * @method POST
     * @expectedPayload { email: string, password: string, name: string }
     */
    REGISTER: '/auth/register',
    
    /**
     * Endpoint for user logout
     * @method POST
     */
    LOGOUT: '/auth/logout',
    
    /**
     * Endpoint for refreshing authentication tokens
     * @method POST
     * @expectedPayload { refreshToken: string }
     */
    REFRESH_TOKEN: '/auth/refresh',
    
    /**
     * Endpoint for password reset requests
     * @method POST
     * @expectedPayload { email: string }
     */
    RESET_PASSWORD: '/auth/reset-password',
  },
  
  /**
   * User management related endpoints
   */
  USERS: {
    /**
     * Base endpoint for user resources
     */
    BASE: '/users',
    
    /**
     * Endpoint for getting a specific user
     * @method GET
     * @param id User ID to be replaced in the URL
     */
    GET_USER: '/users/:id',
    
    /**
     * Endpoint for creating a new user
     * @method POST
     * @expectedPayload User data object
     */
    CREATE_USER: '/users',
    
    /**
     * Endpoint for updating an existing user
     * @method PUT
     * @param id User ID to be replaced in the URL
     * @expectedPayload Updated user data
     */
    UPDATE_USER: '/users/:id',
    
    /**
     * Endpoint for deleting a user
     * @method DELETE
     * @param id User ID to be replaced in the URL
     */
    DELETE_USER: '/users/:id',
  },
};

/**
 * Default API configuration settings
 * Contains base URL, timeout, and default headers
 */
export const API_CONFIG = {
  /**
   * Base URL for API requests
   * Uses environment variable if available, falls back to localhost
   */
  BASE_URL: process.env.VITE_API_URL || 'http://localhost:3000',
  
  /**
   * Default timeout for API requests in milliseconds
   */
  TIMEOUT: API_TIMEOUT,
  
  /**
   * Default headers to include with all API requests
   */
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

/**
 * HTTP status code constants
 * Used for handling API responses and errors
 */
export const HTTP_STATUS = {
  /**
   * Successful response (200 OK)
   */
  OK: 200,
  
  /**
   * Resource created successfully (201 Created)
   */
  CREATED: 201,
  
  /**
   * Bad request due to client error (400 Bad Request)
   */
  BAD_REQUEST: 400,
  
  /**
   * Authentication required or failed (401 Unauthorized)
   */
  UNAUTHORIZED: 401,
  
  /**
   * User does not have permission (403 Forbidden)
   */
  FORBIDDEN: 403,
  
  /**
   * Resource not found (404 Not Found)
   */
  NOT_FOUND: 404,
  
  /**
   * Server encountered an error (500 Internal Server Error)
   */
  INTERNAL_SERVER_ERROR: 500,
};