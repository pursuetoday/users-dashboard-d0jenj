import React, { useMemo } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.2
import Button from './Button';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for Pagination component with comprehensive type safety
 */
export interface PaginationProps {
  /** Current active page number (1-based indexing) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback function when page is changed */
  onPageChange: (page: number) => void;
  /** Whether pagination controls are disabled */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Accessibility label for the pagination navigation */
  ariaLabel?: string;
  /** Theme preference (light or dark) */
  theme?: 'light' | 'dark';
  /** Size variant for the pagination controls */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Generates array of page numbers to display with ellipsis, optimized with memoization
 *
 * @param currentPage - Current active page
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and ellipsis markers
 */
export const generatePageNumbers = (
  currentPage: number,
  totalPages: number
): (number | string)[] => {
  // Validate input parameters
  if (currentPage < 1 || totalPages < 1) {
    return [];
  }
  
  // Handle simple case with few pages
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  // Initialize result array with first page
  const result: (number | string)[] = [1];
  
  // Calculate visible page range (current page and one page on each side)
  let rangeStart = Math.max(2, currentPage - 1);
  let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
  
  // Adjust range to show at least 3 pages (when possible)
  if (rangeEnd - rangeStart < 2) {
    if (currentPage < totalPages / 2) {
      rangeEnd = Math.min(totalPages - 1, rangeStart + 2);
    } else {
      rangeStart = Math.max(2, rangeEnd - 2);
    }
  }
  
  // Add ellipsis before range if needed
  if (rangeStart > 2) {
    result.push('...');
  } else if (rangeStart === 2) {
    result.push(2);
  }
  
  // Add pages in the range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    if (i !== 1 && i !== totalPages) {
      result.push(i);
    }
  }
  
  // Add ellipsis after range if needed
  if (rangeEnd < totalPages - 1) {
    result.push('...');
  } else if (rangeEnd === totalPages - 1) {
    result.push(totalPages - 1);
  }
  
  // Add last page (if not already included)
  if (totalPages > 1) {
    result.push(totalPages);
  }
  
  return result;
};

/**
 * Reusable pagination component that provides navigation controls for paginated data
 * with Tailwind UI styling, WCAG 2.1 Level AA compliance, and keyboard navigation support
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className = '',
  ariaLabel = 'Pagination',
  size = 'md',
}) => {
  // Access theme context for dark mode support
  let theme;
  try {
    const { theme: themeContext } = useTheme();
    theme = themeContext;
  } catch (error) {
    console.error('Pagination: Failed to access theme context:', error);
    // Fallback to light theme
    theme = { mode: 'light', isDark: false };
  }
  
  // Generate page numbers with memoization for performance
  const pageNumbers = useMemo(
    () => generatePageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );
  
  // Early return for invalid inputs
  if (totalPages <= 0 || currentPage <= 0) {
    console.warn('Pagination: Invalid props - totalPages and currentPage must be positive integers');
    return null;
  }
  
  // Handle page change with validation
  const handlePageChange = (page: number): void => {
    if (!disabled && page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };
  
  // Container classes with responsive design and theme support
  const containerClasses = classNames(
    'flex items-center justify-center',
    'gap-1 sm:gap-2',
    theme.isDark ? 'text-gray-200' : 'text-gray-700',
    className
  );
  
  // Size-specific classes
  const sizeClasses = {
    sm: { wrapper: 'text-xs', spacing: 'mx-1' },
    md: { wrapper: 'text-sm', spacing: 'mx-1.5' },
    lg: { wrapper: 'text-base', spacing: 'mx-2' }
  };
  
  // Current page button classes
  const currentPageClasses = classNames(
    'z-10',
    theme.isDark
      ? 'bg-blue-600 text-white'
      : 'bg-blue-50 text-blue-600 border-blue-500',
    'font-medium'
  );
  
  return (
    <nav 
      className={containerClasses}
      aria-label={ariaLabel}
      role="navigation"
    >
      {/* Previous page button */}
      <Button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        ariaLabel="Go to previous page"
        size={size}
        variant="outline"
        className={theme.isDark ? 'dark:border-gray-600' : ''}
      >
        <span className="sr-only">Previous</span>
        <svg 
          className="h-5 w-5" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" 
            clipRule="evenodd" 
          />
        </svg>
      </Button>
      
      {/* Page numbers */}
      <div className={`flex ${sizeClasses[size].wrapper}`}>
        {pageNumbers.map((page, index) => {
          // Handle ellipsis
          if (page === '...') {
            return (
              <span 
                key={`ellipsis-${index}`}
                className={classNames(
                  'flex items-center justify-center',
                  'px-4 py-2',
                  theme.isDark ? 'text-gray-400' : 'text-gray-500',
                  'select-none'
                )}
                aria-hidden="true"
              >
                &hellip;
              </span>
            );
          }
          
          // Handle number buttons
          const pageNum = page as number;
          const isCurrentPage = pageNum === currentPage;
          
          return (
            <button
              key={`page-${pageNum}`}
              onClick={() => handlePageChange(pageNum)}
              disabled={disabled || isCurrentPage}
              className={classNames(
                'flex items-center justify-center',
                'h-8 w-8 sm:h-10 sm:w-10',
                'rounded-md border',
                {
                  [currentPageClasses]: isCurrentPage,
                  [theme.isDark 
                    ? 'dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700' 
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                  ]: !isCurrentPage,
                  'opacity-50 cursor-not-allowed': disabled,
                  'focus:z-20': true,
                },
                'transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                theme.isDark ? 'dark:focus:ring-offset-gray-900' : '',
                sizeClasses[size].spacing
              )}
              aria-current={isCurrentPage ? 'page' : undefined}
              aria-label={`Go to page ${pageNum}`}
              tabIndex={disabled ? -1 : 0}
              data-testid={`pagination-page-${pageNum}`}
              type="button"
            >
              {pageNum}
            </button>
          );
        })}
      </div>
      
      {/* Next page button */}
      <Button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        ariaLabel="Go to next page"
        size={size}
        variant="outline"
        className={theme.isDark ? 'dark:border-gray-600' : ''}
      >
        <span className="sr-only">Next</span>
        <svg 
          className="h-5 w-5" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" 
            clipRule="evenodd" 
          />
        </svg>
      </Button>
    </nav>
  );
};

export default Pagination;
export { PaginationProps };