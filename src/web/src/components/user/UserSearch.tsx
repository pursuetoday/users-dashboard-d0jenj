/**
 * Enhanced search component for filtering users in the User Management Dashboard
 * with debounced input handling, accessibility features, and performance optimization.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // ^18.0.0
import Input from '../common/Input';
import useDebounce from '../../hooks/useDebounce';
import { tableHandlers } from '../../hooks/useUser';

/**
 * Props interface for UserSearch component with comprehensive configuration options
 */
interface UserSearchProps {
  /**
   * Placeholder text for the search input
   */
  placeholder: string;
  
  /**
   * Callback function triggered when search value changes after debounce
   * @param value The sanitized search value
   */
  onSearch: (value: string) => void;
  
  /**
   * Delay in milliseconds before search is triggered after typing stops
   * @default 300
   */
  debounceDelay?: number;
  
  /**
   * Additional CSS class names for styling
   */
  className?: string;
  
  /**
   * Accessibility label for screen readers
   * @default "Search users"
   */
  ariaLabel?: string;
  
  /**
   * Test ID for component testing
   */
  testId?: string;
}

/**
 * Sanitizes search input to prevent XSS attacks
 * @param value The input value to sanitize
 * @returns Sanitized string value
 */
const sanitizeInput = (value: string): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert to string if not already
  const stringValue = String(value);
  
  // Basic XSS prevention by replacing HTML special chars
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
};

/**
 * Enhanced search component for filtering users with debounced input handling,
 * accessibility features, and performance optimizations.
 * 
 * @param props Component props
 * @returns React component
 */
const UserSearch: React.FC<UserSearchProps> = ({
  placeholder,
  onSearch,
  debounceDelay = 300,
  className = '',
  ariaLabel = 'Search users',
  testId = 'user-search-input',
}) => {
  // State for the search input value
  const [searchInput, setSearchInput] = useState<string>('');
  
  // Use the debounce hook to optimize performance
  const debouncedSearchTerm = useDebounce<string>(searchInput, debounceDelay);
  
  // Track loading state for search operations
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // Handle input changes with sanitization and error handling
  const handleSearchChange = useCallback((name: string, value: string): void => {
    try {
      // Sanitize the input value to prevent XSS
      const sanitizedValue = sanitizeInput(value);
      
      // Update the search input state
      setSearchInput(sanitizedValue);
      setIsSearching(true);
      
      // Log search interaction for analytics
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`Search term changed: "${sanitizedValue}"`);
      }
    } catch (error) {
      console.error('Error handling search input:', error);
      // In case of error, clear the search input
      setSearchInput('');
      setIsSearching(false);
    }
  }, []);
  
  // Effect to trigger search when debounced term changes
  useEffect(() => {
    // Trigger the search callback with the debounced term
    onSearch(debouncedSearchTerm);
    setIsSearching(false);
  }, [debouncedSearchTerm, onSearch]);
  
  // Memoize additional props for the Input component
  const inputProps = useMemo(() => ({
    name: 'search',
    label: '', // Empty label since we're using aria-label for accessibility
    placeholder,
    value: searchInput,
    onChange: handleSearchChange,
    'aria-label': ariaLabel,
    'data-testid': testId,
    isLoading: isSearching,
    icon: (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-5 w-5" 
        viewBox="0 0 20 20" 
        fill="currentColor"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" 
          clipRule="evenodd" 
        />
      </svg>
    ),
    iconPosition: 'left',
    // Add validation rules
    validationRules: [
      {
        type: 'maxLength',
        value: 100,
        message: 'Search term is too long'
      }
    ],
    // Add ARIA properties for enhanced accessibility
    ariaProps: {
      description: 'Enter search terms to filter users',
      role: 'searchbox'
    },
    // Add help text for users
    helpText: 'Search by name, email, or role'
  }), [ariaLabel, handleSearchChange, isSearching, placeholder, searchInput, testId]);
  
  return (
    <div className={`relative ${className}`}>
      <Input 
        {...inputProps}
        inputClassName="pl-10 focus:ring-primary-500 focus:border-primary-500"
      />
      
      {/* Hidden live region for screen readers to announce search status */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {isSearching ? 'Searching...' : debouncedSearchTerm ? `Search results for ${debouncedSearchTerm}` : ''}
      </div>
    </div>
  );
};

export default UserSearch;