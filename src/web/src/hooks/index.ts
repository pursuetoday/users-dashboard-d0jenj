/**
 * Hooks Index Module
 * 
 * Centralized export file for all custom React hooks used in the User Management Dashboard application.
 * Provides type-safe exports for authentication, user management, theme handling, and UI optimization hooks.
 * 
 * This module improves code organization, enhances IDE support through TypeScript integration,
 * and ensures consistent hook usage across the application.
 * 
 * @packageDocumentation
 * @module hooks
 * @version 1.0.0
 */

// Import all custom hooks from their respective files
import useDebounce from './useDebounce';
import { useLocalStorage } from './useLocalStorage';
import { useAuth } from './useAuth';
import { useUser } from './useUser';
import { useTheme } from './useTheme';
import { useTable } from './useTable';

// Re-export all hooks with consistent documentation for type safety and IDE support

/**
 * A hook that debounces a value by delaying updates until after a specified delay.
 * Optimizes performance for search inputs, form fields, and other frequently changing values.
 * 
 * @template T - The type of the value being debounced
 * @param {T} value - The value to debounce
 * @param {number} delay - The delay in milliseconds before updating the debounced value
 * @returns {T} - The debounced value
 */
export { useDebounce };

/**
 * A hook that provides persistent state management using browser's localStorage.
 * Features type safety, serialization, error handling, and cross-tab synchronization.
 * 
 * @template T - The type of the state to be stored
 * @param {string} key - The storage key to use in localStorage
 * @param {T} initialValue - The initial value or value factory function
 * @returns {[T, (value: T | ((val: T) => T)) => void]} - A stateful value and a function to update it
 */
export { useLocalStorage };

/**
 * A hook that provides secure authentication functionality.
 * Implements JWT-based authentication with role-based access control, session management,
 * and comprehensive error handling.
 * 
 * @returns Authentication state and methods for user authentication operations
 */
export { useAuth };

/**
 * A hook that manages user data with optimistic updates and cache invalidation.
 * Provides CRUD operations, filtering, pagination, and role-based access control for user management.
 * 
 * @param {UserFilters} [initialFilters] - Initial filter criteria for user listing
 * @returns User management state and functions for data operations
 */
export { useUser };

/**
 * A hook that provides type-safe access to theme context and theme management functions.
 * Features system preference detection, persistent theme selection, and integration with Tailwind UI.
 * 
 * @returns {ThemeContextType} - Theme state and management functions
 */
export { useTheme };

/**
 * A hook that manages table state with comprehensive error handling and performance optimization.
 * Provides pagination, sorting, filtering, and virtual scrolling capabilities for data tables.
 * 
 * @template T - The type of data in the table
 * @param {T[]} [initialData=[]] - Initial data array for the table
 * @param {Partial<TableState<T>>} [initialState={}] - Initial state for the table
 * @param {TableOptions<T>} [options={}] - Options for customizing the table behavior
 * @returns Table state, handlers, and utilities for managing tabular data
 */
export { useTable };