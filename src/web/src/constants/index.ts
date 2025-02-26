/**
 * constants/index.ts
 * 
 * Centralizes and re-exports all constant values used throughout the application.
 * This file serves as the single source of truth for all application constants
 * while maintaining strict TypeScript type safety.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// Re-export all constants from API module
export {
  API_ENDPOINTS,
  API_CONFIG,
  HTTP_STATUS
} from './api.constants';

// Re-export all route-related constants
export {
  PUBLIC_ROUTES,
  PRIVATE_ROUTES,
  ERROR_ROUTES,
  ROUTE_PATHS
} from './routes.constants';

// Re-export all table-related constants
export {
  TABLE_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE,
  SortDirection,
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_FIELD,
  TABLE_LOADING_HEIGHT,
  TABLE_EMPTY_MESSAGE,
  type TableConfig
} from './table.constants';

// Re-export all theme-related constants
export {
  THEME_STORAGE_KEY,
  THEME_MODES,
  THEME_CLASSES,
  DEFAULT_THEME
} from './theme.constants';

// Re-export all validation-related constants
export {
  VALIDATION_RULES,
  VALIDATION_MESSAGES
} from './validation.constants';