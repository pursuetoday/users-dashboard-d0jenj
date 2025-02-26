/**
 * HTTP Status Codes Constants
 * 
 * A comprehensive set of HTTP status codes used throughout the application
 * for consistent HTTP response handling. Organized into categories following
 * HTTP/1.1 specifications.
 * 
 * Used in controllers, middleware, and error handlers to ensure standardized
 * API responses across the application.
 */

export const enum HTTP_STATUS {
  // 2xx - Success responses
  OK = 200,                     // Standard success response for successful HTTP requests
  CREATED = 201,                // Success response for requests that resulted in a new resource being created
  NO_CONTENT = 204,             // Success response for requests that succeeded but return no content
  
  // 4xx - Client error responses
  BAD_REQUEST = 400,            // Client error for malformed requests or invalid input validation
  UNAUTHORIZED = 401,           // Authentication error for missing or invalid authentication credentials
  FORBIDDEN = 403,              // Authorization error for authenticated users lacking required permissions
  NOT_FOUND = 404,              // Resource not found error for requested resources that don't exist
  CONFLICT = 409,               // Conflict error for requests that conflict with current resource state
  UNPROCESSABLE_ENTITY = 422,   // Validation error for semantically incorrect request data
  TOO_MANY_REQUESTS = 429,      // Rate limiting error for exceeding allowed request limits
  
  // 5xx - Server error responses
  INTERNAL_SERVER_ERROR = 500,  // Server error for unexpected conditions preventing request fulfillment
  SERVICE_UNAVAILABLE = 503     // Server error indicating temporary unavailability of the service
}