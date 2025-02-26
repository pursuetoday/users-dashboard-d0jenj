/**
 * React Query Configuration
 * 
 * This file contains global configuration for React Query, which is used for
 * data fetching, caching, and state management throughout the application.
 * 
 * Configuration includes optimized settings for:
 * - Caching strategy and duration
 * - Refetching behavior
 * - Error handling and retries
 * - Network behavior
 * - Performance optimization
 * 
 * @module config/query.config
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query'; // @tanstack/react-query ^4.0.0

/**
 * Global error handler for mutations
 * Centralizes error processing for all mutation operations
 * 
 * @param {unknown} error - The error that occurred during mutation
 */
const globalErrorHandler = (error: unknown): void => {
  // Log to console in development
  console.error('Mutation error:', error);
  
  // In a production environment, this would be connected to:
  // 1. Error monitoring service (e.g., New Relic)
  // 2. Analytics for tracking error rates
  // 3. User notification system (e.g., toast notifications)
};

/**
 * Default configuration options for React Query with optimized settings
 * for performance and reliability.
 */
export const queryConfig: DefaultOptions = {
  queries: {
    // Controlled refetching: don't refetch on window focus to reduce unnecessary network requests
    refetchOnWindowFocus: false,
    
    // Always refetch when the query mounts to ensure data freshness
    refetchOnMount: true,
    
    // Refetch when reconnecting to network to ensure data consistency
    refetchOnReconnect: true,
    
    // Retry failed queries twice with exponential backoff (handled by React Query)
    retry: 2,
    
    // Data considered stale after 5 minutes (300000ms)
    staleTime: 300000,
    
    // Unused/inactive queries remain in cache for 15 minutes (900000ms)
    cacheTime: 900000,
    
    // Not using React Suspense for data fetching
    suspense: false,
    
    // Handle errors locally rather than propagating to React Error Boundary
    useErrorBoundary: false,
    
    // Behavior when network status changes
    networkMode: 'online',
    
    // No automatic polling - can be enabled per-query as needed
    refetchInterval: false,
  },
  
  mutations: {
    // Retry failed mutations twice
    retry: 2,
    
    // Handle errors locally rather than propagating to React Error Boundary
    useErrorBoundary: false,
    
    // Behavior when network status changes
    networkMode: 'online',
    
    // Global error handler for mutations
    onError: globalErrorHandler,
  },
};

/**
 * Configured QueryClient instance with optimized settings.
 * This is used throughout the application for data fetching,
 * caching, and state management.
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

/**
 * Default export of the query client for convenience
 */
export default queryClient;