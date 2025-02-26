/**
 * Table Constants
 * 
 * This file defines constant values and configurations for table components
 * including pagination, sorting, and display settings with TypeScript type safety and immutability.
 */

/**
 * Available page size options for table pagination
 */
export const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * Default number of items per page
 */
export const DEFAULT_PAGE_SIZE = 10 as const;

/**
 * Default starting page number
 */
export const DEFAULT_PAGE = 1 as const;

/**
 * Type-safe enum for sort direction options
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Default sort direction
 */
export const DEFAULT_SORT_DIRECTION = SortDirection.ASC as const;

/**
 * Default field to sort by
 */
export const DEFAULT_SORT_FIELD = 'createdAt' as const;

/**
 * Minimum height for table loading state
 */
export const TABLE_LOADING_HEIGHT = '200px' as const;

/**
 * Default message for empty table state
 */
export const TABLE_EMPTY_MESSAGE = 'No data available' as const;

/**
 * Type-safe interface for table configuration
 */
export interface TableConfig {
  pageSize: number;
  page: number;
  sortDirection: SortDirection;
  sortField: string;
}