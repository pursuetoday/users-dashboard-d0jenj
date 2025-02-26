/**
 * Constants Index
 * 
 * Central export file that aggregates and re-exports all constant values from the constants directory,
 * providing a single point of access for application constants including HTTP status codes,
 * error messages, validation messages, and role definitions.
 * 
 * This approach ensures type safety, immutability, and proper organization of all system constants.
 * Used throughout the application to maintain consistent error handling, validation, and access control.
 */

// Re-export HTTP status codes
export { HTTP_STATUS } from './http-status';

// Re-export error message constants
export {
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  DATABASE_ERRORS,
  SYSTEM_ERRORS,
  CACHE_ERRORS
} from './error-messages';

// Re-export validation message constants
export {
  AUTH_VALIDATION_MESSAGES,
  USER_VALIDATION_MESSAGES,
  QUERY_VALIDATION_MESSAGES
} from './validation-messages';

// Re-export role-based access control constants
export {
  ROLES,
  ROLE_HIERARCHY,
  DEFAULT_ROLE
} from './roles';