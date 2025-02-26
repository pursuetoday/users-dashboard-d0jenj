import React, { useCallback, useMemo, memo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { useTable, TableState, TableHandlers } from '../../hooks/useTable';
import Spinner from './Spinner';
import Pagination from './Pagination';
import {
  TABLE_PAGE_SIZES,
  TABLE_LOADING_HEIGHT,
  TABLE_EMPTY_MESSAGE,
  SortDirection
} from '../../constants/table.constants';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../hooks/useTheme';

/**
 * Interface for column configuration with type safety
 */
export interface TableColumn<T> {
  /** Unique identifier for the column */
  id: string;
  /** Header text to display */
  header: string;
  /** Field in data object to display */
  field: keyof T;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Custom cell renderer function */
  renderCell?: (item: T) => React.ReactNode;
  /** Column width (CSS value or Tailwind class) */
  width?: string;
  /** Additional CSS classes for the column */
  className?: string;
  /** Whether to hide column on mobile devices */
  hideOnMobile?: boolean;
  /** Accessibility label for the column */
  ariaLabel?: string;
}

/**
 * Available theme variants for the table
 */
export type TableThemeVariant = 'default' | 'striped' | 'bordered' | 'minimal';

/**
 * Props interface for Table component with enhanced accessibility and theme support
 */
export interface TableProps<T> {
  /** Array of data items to display */
  data: T[];
  /** Column configuration array */
  columns: TableColumn<T>[];
  /** Loading state indicator */
  isLoading?: boolean;
  /** Total number of items across all pages */
  totalItems: number;
  /** Type-safe sort handler function */
  onSort?: (field: keyof T, direction: SortDirection) => void;
  /** Page change handler function */
  onPageChange?: (page: number) => void;
  /** Page size change handler function */
  onPageSizeChange?: (pageSize: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Accessible table label */
  ariaLabel?: string;
  /** Theme variant for table styling */
  themeVariant?: TableThemeVariant;
}

/**
 * Wraps a component with error boundary functionality
 */
function withErrorBoundary<T extends Record<string, any>>(
  Component: React.ComponentType<TableProps<T>>
): React.FC<TableProps<T>> {
  return (props: TableProps<T>) => {
    try {
      return <Component {...props} />;
    } catch (error) {
      console.error('Table error:', error);
      return (
        <div className="p-4 border border-red-300 rounded text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          An error occurred while rendering the table. Please try again or contact support.
        </div>
      );
    }
  };
}

/**
 * A function to safely access nested object properties using dot notation
 */
const getNestedValue = <T extends Record<string, any>>(
  obj: T,
  path: keyof T
): any => {
  if (typeof path !== 'string') {
    return obj[path];
  }
  
  return path.split('.').reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : null;
  }, obj as any);
};

/**
 * Renders a data table with sorting, pagination, responsive design, and accessibility features
 */
const TableComponent = <T extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  totalItems,
  onSort,
  onPageChange,
  onPageSizeChange,
  className = '',
  ariaLabel = 'Data table',
  themeVariant = 'default',
}: TableProps<T>): JSX.Element => {
  // Access theme context
  const { theme } = useTheme();
  
  // Initialize table state and handlers
  const { state, handlers, utils } = useTable<T>(
    data,
    {
      totalItems,
      isLoading
    }
  );

  // Handle sort when column header is clicked
  const handleSort = useCallback(
    (field: keyof T, direction: SortDirection) => {
      if (onSort) {
        onSort(field, direction);
      } else {
        handlers.onSort(field, direction);
      }
    },
    [onSort, handlers]
  );

  // Handle page change from pagination component
  const handlePageChange = useCallback(
    (page: number) => {
      if (onPageChange) {
        onPageChange(page);
      } else {
        handlers.onPageChange(page);
      }
    },
    [onPageChange, handlers]
  );

  // Handle page size change from dropdown
  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      if (onPageSizeChange) {
        onPageSizeChange(pageSize);
      } else {
        handlers.onPageSizeChange(pageSize);
      }
    },
    [onPageSizeChange, handlers]
  );

  // Generate theme-specific class names for table elements
  const tableClasses = useMemo(() => getTableClasses(theme, themeVariant, className), [theme, themeVariant, className]);
  const headerClasses = useMemo(() => getHeaderClasses(theme, themeVariant), [theme, themeVariant]);
  const rowClasses = useMemo(() => getRowClasses(theme, themeVariant), [theme, themeVariant]);
  const cellClasses = useMemo(() => getCellClasses(theme, themeVariant), [theme, themeVariant]);

  // If loading, show spinner
  if (isLoading) {
    return (
      <div 
        className="flex justify-center items-center"
        style={{ height: TABLE_LOADING_HEIGHT }}
        aria-live="polite"
        role="status"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  // If no data, show empty message
  if (data.length === 0) {
    return (
      <div 
        className={classNames(
          "text-center p-6",
          theme.isDark ? "text-gray-400" : "text-gray-500"
        )}
        role="status"
        aria-label="No data available"
      >
        {TABLE_EMPTY_MESSAGE}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table with responsive overflow container */}
      <div className="overflow-x-auto rounded-lg shadow-sm">
        <table 
          className={tableClasses}
          aria-label={ariaLabel}
          role="grid"
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={classNames(
                    headerClasses,
                    column.className,
                    {
                      'cursor-pointer select-none': column.sortable,
                      'hidden sm:table-cell': column.hideOnMobile,
                    },
                    column.width ? column.width : ''
                  )}
                  onClick={() => {
                    if (column.sortable) {
                      const currentSort = state.sortField === column.field;
                      const direction = currentSort && state.sortDirection === SortDirection.ASC
                        ? SortDirection.DESC
                        : SortDirection.ASC;
                      handleSort(column.field, direction);
                    }
                  }}
                  style={column.width && !column.width.includes('w-') ? { width: column.width } : {}}
                  aria-sort={
                    state.sortField === column.field
                      ? state.sortDirection === SortDirection.ASC
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  tabIndex={column.sortable ? 0 : -1}
                  role="columnheader"
                  aria-label={column.ariaLabel || column.header}
                >
                  <div className="flex items-center justify-between">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="ml-2 inline-flex">
                        {state.sortField === column.field ? (
                          state.sortDirection === SortDirection.ASC ? (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path
                                fillRule="evenodd"
                                d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 4.414 6.707 7.707a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path
                                fillRule="evenodd"
                                d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 15.586l3.293-3.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )
                        ) : (
                          <svg className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path
                              fillRule="evenodd"
                              d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item, rowIndex) => (
              <tr 
                key={`row-${rowIndex}`}
                className={rowClasses}
                role="row"
              >
                {columns.map((column) => {
                  const value = getNestedValue(item, column.field);
                  
                  return (
                    <td
                      key={`cell-${rowIndex}-${column.id}`}
                      className={classNames(
                        cellClasses,
                        column.className,
                        {
                          'hidden sm:table-cell': column.hideOnMobile,
                        }
                      )}
                      role="cell"
                    >
                      {column.renderCell ? column.renderCell(item) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {utils.getTotalPages() > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {/* Results information */}
          <div className="text-sm text-gray-700 dark:text-gray-300 mb-4 sm:mb-0">
            Showing 
            <span className="font-medium mx-1">{utils.getStartIndex()}</span>
            to
            <span className="font-medium mx-1">{utils.getEndIndex()}</span>
            of
            <span className="font-medium ml-1">{state.totalItems}</span>
            results
          </div>

          {/* Page size selector and pagination */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <label htmlFor="table-page-size" className="sr-only">
                Items per page
              </label>
              <select
                id="table-page-size"
                value={state.pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className={classNames(
                  "form-select rounded-md text-sm",
                  theme.isDark 
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-700"
                )}
                aria-label="Items per page"
              >
                {TABLE_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </div>

            <Pagination
              currentPage={state.page}
              totalPages={utils.getTotalPages()}
              onPageChange={handlePageChange}
              disabled={isLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Generate theme-specific table classes
 */
const getTableClasses = (
  theme: Theme,
  themeVariant: TableThemeVariant,
  className: string
): string => {
  return classNames(
    'min-w-full divide-y divide-gray-200 dark:divide-gray-700',
    {
      'bg-white dark:bg-gray-800': themeVariant !== 'minimal',
      'shadow-sm rounded-lg': themeVariant !== 'minimal',
      'border border-gray-200 dark:border-gray-700': themeVariant === 'bordered',
    },
    className
  );
};

/**
 * Generate theme-specific header classes
 */
const getHeaderClasses = (
  theme: Theme,
  themeVariant: TableThemeVariant
): string => {
  return classNames(
    'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider',
    theme.isDark ? 'text-gray-300 bg-gray-700' : 'text-gray-500 bg-gray-50',
    {
      'border-b dark:border-gray-600': true,
    }
  );
};

/**
 * Generate theme-specific row classes
 */
const getRowClasses = (
  theme: Theme,
  themeVariant: TableThemeVariant
): string => {
  return classNames(
    'hover:bg-gray-50 dark:hover:bg-gray-700 group',
    {
      'bg-white dark:bg-gray-800': themeVariant !== 'striped',
      'even:bg-gray-50 dark:even:bg-gray-700/50': themeVariant === 'striped',
      'border-b dark:border-gray-700': true,
    }
  );
};

/**
 * Generate theme-specific cell classes
 */
const getCellClasses = (
  theme: Theme,
  themeVariant: TableThemeVariant
): string => {
  return classNames(
    'px-6 py-4 whitespace-nowrap text-sm',
    theme.isDark ? 'text-gray-300' : 'text-gray-500',
    {
      'border-r last:border-r-0 dark:border-gray-700': themeVariant === 'bordered',
    }
  );
};

// Apply error boundary and memoization for performance optimization
const Table = withErrorBoundary(memo(TableComponent)) as <T extends Record<string, any>>(
  props: TableProps<T>
) => JSX.Element;

export default Table;