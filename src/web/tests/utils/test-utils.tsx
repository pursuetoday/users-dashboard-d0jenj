/**
 * Test Utilities for User Management Dashboard
 * 
 * Provides comprehensive testing utilities for React component testing with
 * React Testing Library, supporting authentication, theme management, data
 * fetching, and other global contexts with extensive error handling and
 * performance optimizations.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import React, { ReactNode, ErrorInfo } from 'react';
import { render, RenderOptions } from '@testing-library/react'; // ^14.0.0
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // ^4.0.0
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { ThemeProvider } from '../../src/context/ThemeContext';

/**
 * Creates a configured React Query client optimized for testing
 * with error handling and performance settings
 * 
 * @param options - Optional configuration overrides
 * @returns Configured query client instance with test-specific settings
 */
export function createTestQueryClient(options = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries for predictable tests
        retry: false,
        // Prevent background refetching
        refetchOnWindowFocus: false,
        // Keep data indefinitely in tests
        staleTime: Infinity,
        // Never garbage collect test data
        cacheTime: Infinity,
      },
      mutations: {
        // Disable retries for mutations
        retry: false,
      },
    },
    // Configure error handling
    logger: {
      log: console.log,
      warn: console.warn,
      // Silence errors in test environment
      error: process.env.NODE_ENV === 'test' ? () => {} : console.error,
    },
    ...options,
  });
}

/**
 * Error boundary component for tests
 */
class TestErrorBoundary extends React.Component<{
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div data-testid="error-boundary-fallback">
          Test Error: {this.state.error?.message || 'Unknown error'}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Performance monitoring class for test timing
 */
class PerformanceMonitor {
  startTime: number;
  measures: Record<string, number>;

  constructor() {
    this.startTime = this.now();
    this.measures = {};
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  start(label: string): void {
    this.measures[label] = this.now();
  }

  end(label: string): void {
    if (this.measures[label]) {
      const endTime = this.now();
      this.measures[label] = endTime - this.measures[label];
    }
  }

  getResults(): Record<string, number> {
    return { 
      ...this.measures, 
      totalTime: this.now() - this.startTime 
    };
  }

  reset(): void {
    this.measures = {};
    this.startTime = this.now();
  }
}

/**
 * Props for the AllTheProviders component
 */
interface AllTheProvidersProps {
  children: ReactNode;
  options?: {
    // React Query options
    queryClient?: QueryClient;
    
    // Auth context options
    authOptions?: {
      isAuthenticated?: boolean;
      user?: any;
      error?: any;
      mockLogin?: boolean;
      mockLogout?: boolean;
    };
    
    // Theme context options
    themeOptions?: {
      initialTheme?: 'light' | 'dark' | 'system';
      mockThemeToggle?: boolean;
    };
    
    // Error handling options
    errorOptions?: {
      onError?: (error: Error, errorInfo: ErrorInfo) => void;
      fallback?: React.ReactNode;
    };
    
    // Performance monitoring
    enablePerformanceMonitoring?: boolean;
  };
}

/**
 * Comprehensive provider wrapper component with error handling
 * and performance optimization
 */
export class AllTheProviders extends React.Component<AllTheProvidersProps> {
  queryClient: QueryClient;
  errorBoundaryRef: React.RefObject<TestErrorBoundary>;
  performanceMonitor: PerformanceMonitor;

  constructor(props: AllTheProvidersProps) {
    super(props);
    
    // Initialize query client
    this.queryClient = props.options?.queryClient || createTestQueryClient();
    
    // Initialize error boundary reference
    this.errorBoundaryRef = React.createRef<TestErrorBoundary>();
    
    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor();
    
    // Start performance monitoring if enabled
    if (props.options?.enablePerformanceMonitoring) {
      this.performanceMonitor.start('constructor');
    }
  }

  /**
   * Performs cleanup of test resources and state
   */
  cleanup = (): void => {
    // Reset React Query cache
    this.queryClient.clear();
    
    // Reset error boundary if available
    if (this.errorBoundaryRef.current) {
      this.errorBoundaryRef.current.reset();
    }
    
    // Reset performance monitors
    this.performanceMonitor.reset();
  }

  componentDidMount(): void {
    if (this.props.options?.enablePerformanceMonitoring) {
      this.performanceMonitor.end('constructor');
      this.performanceMonitor.start('mounted');
    }
  }

  componentWillUnmount(): void {
    if (this.props.options?.enablePerformanceMonitoring) {
      this.performanceMonitor.end('mounted');
    }
    
    // Cleanup resources when unmounting
    this.cleanup();
  }

  render(): React.ReactNode {
    const { children, options = {} } = this.props;
    const { 
      authOptions = {}, 
      themeOptions = {}, 
      errorOptions = {},
      enablePerformanceMonitoring = false
    } = options;
    
    // Start render timing if monitoring enabled
    if (enablePerformanceMonitoring) {
      this.performanceMonitor.start('render');
    }
    
    // Create the provider stack
    const element = (
      <QueryClientProvider client={this.queryClient}>
        <AuthProvider
          config={{
            // Use in-memory storage for tests
            persistState: false,
            // Don't refresh token during tests
            autoRefresh: false,
          }}
        >
          <ThemeProvider>
            <TestErrorBoundary
              ref={this.errorBoundaryRef}
              onError={errorOptions.onError}
              fallback={errorOptions.fallback}
            >
              {children}
            </TestErrorBoundary>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    // End render timing if monitoring enabled
    if (enablePerformanceMonitoring) {
      this.performanceMonitor.end('render');
    }
    
    return element;
  }
}

/**
 * Enhanced render function that wraps components with all necessary providers
 * 
 * @param ui - React component to render
 * @param options - Render options and provider configuration
 * @returns Extended render result with additional utilities and helper methods
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & {
    providerOptions?: AllTheProvidersProps['options'];
  } = {}
) {
  const { providerOptions, ...renderOptions } = options;
  
  // Create shared query client
  const queryClient = providerOptions?.queryClient || createTestQueryClient();
  
  // Create providers instance
  const providers = new AllTheProviders({
    children: null,
    options: {
      ...providerOptions,
      queryClient,
    }
  });
  
  // Define wrapper component
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders
      options={{
        ...providerOptions,
        queryClient,
      }}
    >
      {children}
    </AllTheProviders>
  );
  
  // Render with RTL
  const renderResult = render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });
  
  // Return enhanced render result
  return {
    ...renderResult,
    // Add provider utilities
    queryClient,
    // Add cleanup method
    cleanup: () => {
      providers.cleanup();
      renderResult.unmount();
    },
  };
}