/**
 * useTable Hook
 *
 * A custom React hook that manages table state and functionality including
 * pagination, sorting, and data handling with TypeScript support.
 * Implements virtual scrolling for performance optimization and provides
 * comprehensive error handling.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import type { User } from '../types/user.types';
import { 
  TABLE_PAGE_SIZES, 
  DEFAULT_PAGE_SIZE, 
  DEFAULT_PAGE,
  SortDirection 
} from '../constants/table.constants';

/**
 * Generic interface for table state with type-safe field definitions
 */
export interface TableState<T> {
  /** Current table data */
  data: T[];
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Field to sort by (null for no sorting) */
  sortField: keyof T | null;
  /** Sort direction (asc/desc) */
  sortDirection: SortDirection;
  /** Total number of items across all pages */
  totalItems: number;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Current error state (null if no error) */
  error: Error | null;
}

/**
 * Interface for type-safe table event handlers with error handling
 */
export interface TableHandlers {
  /** Handler for page changes */
  onPageChange: (page: number) => Promise<void>;
  /** Handler for page size changes */
  onPageSizeChange: (pageSize: number) => Promise<void>;
  /** Handler for sorting changes */
  onSort: <T>(field: keyof T, direction: SortDirection) => Promise<void>;
  /** Handler for error states */
  onError: (error: Error) => void;
}

/**
 * Interface for table configuration options
 */
export interface TableOptions<T> {
  /** Function to fetch data from an API */
  fetchData?: (
    page: number, 
    pageSize: number, 
    sortField: keyof T | null, 
    sortDirection: SortDirection
  ) => Promise<{ data: T[], total: number }>;
  /** Whether to enable virtual scrolling */
  enableVirtualization?: boolean;
  /** Height of the virtual scroll container in pixels */
  virtualScrollHeight?: number;
  /** Debounce time in milliseconds for pagination events */
  debounceMs?: number;
  /** Custom error handler function */
  onError?: (error: Error) => void;
  /** Callback when data changes */
  onDataChange?: (data: T[]) => void;
}

/**
 * Interface for table utility functions
 */
export interface TableUtils {
  /** Get the current page data */
  getCurrentPageData: <T>() => T[];
  /** Get the total number of pages */
  getTotalPages: () => number;
  /** Get available page size options */
  getPageSizes: () => readonly number[];
  /** Check if currently on the first page */
  getIsFirstPage: () => boolean;
  /** Check if currently on the last page */
  getIsLastPage: () => boolean;
  /** Get the index of the first item on the current page */
  getStartIndex: () => number;
  /** Get the index of the last item on the current page */
  getEndIndex: () => number;
}

/**
 * Props for the virtual scrolling component
 */
export interface VirtualScrollProps {
  /** Height of the virtual scroll container */
  height: number;
  /** Total number of items to render */
  itemCount: number;
  /** Height of each item in pixels */
  itemSize: number;
  /** Number of items to render outside of the visible area */
  overscanCount: number;
  /** Callback fired when the visible items change */
  onItemsRendered: (info: { visibleStartIndex: number; visibleStopIndex: number }) => void;
}

/**
 * Custom hook for managing table state with comprehensive error handling
 * and performance optimization
 *
 * @param initialData - Initial data array for the table
 * @param initialState - Initial state for the table
 * @param options - Options for customizing the table behavior
 * @returns Object containing state, handlers, reset function, and utilities
 */
export function useTable<T extends Record<string, any>>(
  initialData: T[] = [],
  initialState: Partial<TableState<T>> = {},
  options: TableOptions<T> = {}
) {
  // Default options with reasonable defaults
  const {
    fetchData,
    enableVirtualization = false,
    virtualScrollHeight = 400,
    debounceMs = 300,
    onError: customErrorHandler,
    onDataChange
  } = options;

  // Initialize state with defaults or provided values
  const [state, setState] = useState<TableState<T>>({
    data: initialData,
    page: initialState.page || DEFAULT_PAGE,
    pageSize: initialState.pageSize || DEFAULT_PAGE_SIZE,
    sortField: initialState.sortField || null,
    sortDirection: initialState.sortDirection || SortDirection.ASC,
    totalItems: initialState.totalItems || initialData.length,
    isLoading: false,
    error: null
  });

  // Track if component is mounted to prevent state updates after unmounting
  const [isMounted, setIsMounted] = useState(true);

  // Setup initial component lifecycle
  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Notify when data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange(state.data);
    }
  }, [state.data, onDataChange]);

  /**
   * Debounce function for handlers to prevent excessive updates
   */
  const debounce = useCallback(
    <Args extends any[]>(
      func: (...args: Args) => Promise<void>, 
      delay: number
    ) => {
      let timeoutId: NodeJS.Timeout;
      
      return (...args: Args) => {
        return new Promise<void>((resolve, reject) => {
          clearTimeout(timeoutId);
          
          timeoutId = setTimeout(async () => {
            try {
              await func(...args);
              resolve();
            } catch (error) {
              reject(error);
            }
          }, delay);
        });
      };
    },
    []
  );

  /**
   * Error handling function with logging and state updates
   */
  const handleError = useCallback(
    (error: Error) => {
      if (isMounted) {
        setState(prev => ({ ...prev, error, isLoading: false }));
      }
      
      // Call custom error handler if provided
      if (customErrorHandler) {
        customErrorHandler(error);
      } else {
        console.error('[useTable] Error:', error);
      }
    },
    [isMounted, customErrorHandler]
  );

  /**
   * Load data from API or process local data
   */
  const loadData = useCallback(
    async (
      page: number, 
      pageSize: number, 
      sortField: keyof T | null, 
      sortDirection: SortDirection
    ) => {
      if (!isMounted) return;
      
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        if (fetchData) {
          // Get data from API
          const { data, total } = await fetchData(page, pageSize, sortField, sortDirection);
          
          if (isMounted) {
            setState(prev => ({
              ...prev,
              data,
              totalItems: total,
              isLoading: false
            }));
          }
        } else {
          // Local data handling - sort and paginate in-memory
          let filteredData = [...initialData];
          
          // Apply sorting
          if (sortField) {
            filteredData.sort((a, b) => {
              const aValue = a[sortField];
              const bValue = b[sortField];
              
              if (aValue === bValue) return 0;
              
              const comparison = aValue < bValue ? -1 : 1;
              return sortDirection === SortDirection.ASC ? comparison : -comparison;
            });
          }
          
          // Calculate pagination
          const start = (page - 1) * pageSize;
          const paginatedData = filteredData.slice(start, start + pageSize);
          
          if (isMounted) {
            setState(prev => ({
              ...prev,
              data: paginatedData,
              totalItems: filteredData.length,
              isLoading: false
            }));
          }
        }
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error loading data'));
      }
    },
    [fetchData, initialData, isMounted, handleError]
  );

  // Effect to load data when pagination or sorting changes
  useEffect(() => {
    loadData(state.page, state.pageSize, state.sortField, state.sortDirection);
  }, [state.page, state.pageSize, state.sortField, state.sortDirection, loadData]);

  /**
   * Handler for page changes with validation
   */
  const handlePageChange = useCallback(
    async (page: number) => {
      if (!isMounted || page < 1) return;
      
      try {
        const maxPage = Math.max(Math.ceil(state.totalItems / state.pageSize), 1);
        const safePageNumber = Math.min(Math.max(1, page), maxPage);
        
        setState(prev => ({ ...prev, page: safePageNumber }));
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Error changing page'));
      }
    },
    [isMounted, state.totalItems, state.pageSize, handleError]
  );

  /**
   * Debounced page change handler to prevent excessive updates
   */
  const debouncedPageChange = useMemo(
    () => debounce(handlePageChange, debounceMs),
    [handlePageChange, debounce, debounceMs]
  );

  /**
   * Handler for page size changes with validation
   */
  const handlePageSizeChange = useCallback(
    async (pageSize: number) => {
      if (!isMounted) return;
      
      try {
        // Validate that pageSize is one of the allowed sizes
        if (!TABLE_PAGE_SIZES.includes(pageSize as any)) {
          throw new Error(`Invalid page size: ${pageSize}`);
        }
        
        // When changing page size, adjust current page to keep the first visible record on screen if possible
        const firstItemIndex = (state.page - 1) * state.pageSize;
        const newPage = Math.floor(firstItemIndex / pageSize) + 1 || 1;
        
        setState(prev => ({
          ...prev,
          pageSize,
          page: newPage
        }));
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Error changing page size'));
      }
    },
    [isMounted, state.page, state.pageSize, handleError]
  );

  /**
   * Handler for sort changes
   */
  const handleSort = useCallback(
    async <K extends keyof T>(field: K, direction: SortDirection) => {
      if (!isMounted) return;
      
      try {
        setState(prev => ({
          ...prev,
          sortField: field,
          sortDirection: direction,
          // Reset to first page when sorting changes
          page: DEFAULT_PAGE
        }));
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Error applying sort'));
      }
    },
    [isMounted, handleError]
  );

  /**
   * Function to reset table to initial state
   */
  const resetTable = useCallback(() => {
    if (!isMounted) return;
    
    setState({
      data: initialData,
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      sortField: null,
      sortDirection: SortDirection.ASC,
      totalItems: initialData.length,
      isLoading: false,
      error: null
    });
  }, [initialData, isMounted]);

  /**
   * Table utility functions for pagination calculations
   */
  const tableUtils = useMemo<TableUtils>(
    () => ({
      getCurrentPageData: <T>() => state.data as unknown as T[],
      
      getTotalPages: () => Math.max(Math.ceil(state.totalItems / state.pageSize), 1),
      
      getPageSizes: () => TABLE_PAGE_SIZES,
      
      getIsFirstPage: () => state.page <= 1,
      
      getIsLastPage: () => {
        const totalPages = Math.max(Math.ceil(state.totalItems / state.pageSize), 1);
        return state.page >= totalPages;
      },
      
      getStartIndex: () => state.totalItems === 0 ? 0 : (state.page - 1) * state.pageSize + 1,
      
      getEndIndex: () => {
        const endIndex = state.page * state.pageSize;
        return state.totalItems === 0 ? 0 : Math.min(endIndex, state.totalItems);
      }
    }),
    [state.data, state.page, state.pageSize, state.totalItems]
  );

  /**
   * Virtual scrolling configuration
   */
  const virtualScrollProps = useMemo((): VirtualScrollProps | undefined => {
    if (!enableVirtualization) return undefined;
    
    return {
      height: virtualScrollHeight,
      itemCount: state.totalItems,
      itemSize: 50, // Default row height
      overscanCount: 5,
      onItemsRendered: (info: { visibleStartIndex: number; visibleStopIndex: number }) => {
        // Update the current page based on visible items
        if (state.isLoading) return;
        
        const visibleItemsMiddleIndex = Math.floor(
          (info.visibleStartIndex + info.visibleStopIndex) / 2
        );
        
        const calculatedPage = Math.floor(visibleItemsMiddleIndex / state.pageSize) + 1;
        
        if (calculatedPage !== state.page) {
          // Update page without triggering data fetch (data is already visible)
          setState(prev => ({ ...prev, page: calculatedPage }));
        }
      }
    };
  }, [enableVirtualization, virtualScrollHeight, state.totalItems, state.isLoading, state.page, state.pageSize]);

  /**
   * Combined handlers for the table
   */
  const handlers: TableHandlers = useMemo(
    () => ({
      onPageChange: debouncedPageChange,
      onPageSizeChange: handlePageSizeChange,
      onSort: handleSort,
      onError: handleError
    }),
    [debouncedPageChange, handlePageSizeChange, handleSort, handleError]
  );

  // Return hook values
  return {
    state,
    handlers,
    resetTable,
    utils: tableUtils,
    virtualScrollProps
  };
}