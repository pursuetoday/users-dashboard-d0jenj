/**
 * API Types for User Management Dashboard
 * @packageDocumentation
 * @version 1.0.0
 */

import type { AxiosRequestConfig } from 'axios'; // ^1.4.0

/**
 * Enum for supported HTTP methods in the application
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * Enum for categorizing different types of API errors
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Generic interface for standardized API responses with type-safe data payload
 * @template T - Type of the data payload
 */
export interface ApiResponse<T> {
  /** The response data payload */
  data: T;
  /** Human-readable message about the response */
  message: string;
  /** HTTP status code */
  status: number;
  /** ISO timestamp of when the response was generated */
  timestamp: string | null;
}

/**
 * Interface for standardized error responses with detailed error information
 */
export interface ApiError {
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  status: number;
  /** Field-level validation errors mapped by field name */
  errors: Record<string, string[]>;
  /** Error code for client-side error handling */
  code: string;
  /** Stack trace (only included in development) */
  stack: string | null;
}

/**
 * Extended interface for request configuration with additional custom properties
 * Extends the standard Axios request config with application-specific options
 */
export interface RequestConfig extends AxiosRequestConfig {
  /** Custom headers to include with the request */
  headers: Record<string, string>;
  /** URL query parameters */
  params: Record<string, any>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout: number;
  /** Whether to include credentials in cross-origin requests */
  withCredentials: boolean;
  /** Whether the request requires authentication */
  requiresAuth: boolean;
  /** Number of retry attempts for failed requests */
  retryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
}

/**
 * Generic interface for paginated API responses with metadata
 * @template T - Type of items in the data array
 */
export interface PaginatedResponse<T> {
  /** Array of data items */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page available */
  hasNextPage: boolean;
  /** Whether there is a previous page available */
  hasPreviousPage: boolean;
}