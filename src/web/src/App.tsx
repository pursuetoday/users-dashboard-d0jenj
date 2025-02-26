/**
 * Root application component for User Management Dashboard
 * 
 * This component sets up the application providers, routing, and global configurations
 * with optimized provider hierarchy and enhanced security measures.
 *
 * Features:
 * - Optimized React Query configuration with caching and retry logic
 * - Global error boundary with monitoring and recovery
 * - Theme management with system preference detection
 * - Secure authentication with JWT and role-based access control
 * - Performance monitoring and optimization
 *
 * @packageDocumentation
 * @version 1.0.0
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query'; // ^4.0.0
import { ReactQueryDevtools } from 'react-query/devtools'; // ^4.0.0

// Internal imports
import AppRoutes from './routes';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

/**
 * Creates and configures the React Query client instance with optimized settings
 * @returns Configured query client instance with enhanced caching and retry logic
 */
const createQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time of 5 minutes for better caching
        staleTime: 5 * 60 * 1000,
        // Cache time of 10 minutes
        cacheTime: 10 * 60 * 1000,
        // Retry failed queries with exponential backoff
        retry: (failureCount, error: any) => {
          // Don't retry on 404s or 401s
          if (error?.response?.status === 404 || error?.response?.status === 401) {
            return false;
          }
          return failureCount < 3;
        },
        // Refetch on window focus for data freshness
        refetchOnWindowFocus: true,
        // Use stale data while revalidating
        keepPreviousData: true,
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
      },
    },
  });
};

/**
 * Root application component that wraps the entire app with necessary providers in optimized order
 * @returns Root application JSX structure with properly nested providers
 */
export const App: React.FC = (): JSX.Element => {
  // Create the React Query client instance
  const queryClient = React.useMemo(() => createQueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
      {/* Only include React Query Devtools in development environment */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools position="bottom-right" />}
    </QueryClientProvider>
  );
};

export default App;