import React, { Component, ErrorInfo } from 'react';
import { Alert } from '../common/Alert';

/**
 * Props interface for ErrorBoundary component with optional fallback UI
 */
interface ErrorBoundaryProps {
  /** Child components to be rendered inside the error boundary */
  children: React.ReactNode;
  /** Custom fallback UI to render when an error occurs. 
   * If not provided, a default error message will be displayed
   */
  fallback?: React.ReactNode;
}

/**
 * State interface for ErrorBoundary component tracking error status
 */
interface ErrorBoundaryState {
  /** Whether an error has occurred within the boundary */
  hasError: boolean;
  /** The error object if an error has occurred, null otherwise */
  error: Error | null;
}

/**
 * A React error boundary component that catches JavaScript errors anywhere in its child 
 * component tree and displays a fallback UI instead of crashing the application.
 * 
 * This component leverages React's error boundary pattern to:
 * - Prevent the entire application from crashing due to component errors
 * - Display user-friendly error messages
 * - Log errors for debugging and monitoring
 * - Maintain proper focus management for accessibility
 * 
 * @example
 * <ErrorBoundary fallback={<CustomErrorComponent />}>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /**
   * Initializes the error boundary with default error-free state
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Static lifecycle method that updates state when an error occurs
   * 
   * This method is called during the "render" phase, so side-effects are not permitted.
   * 
   * @param error - The error that was thrown
   * @returns Updated state object with error information
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  /**
   * Lifecycle method for error logging and reporting
   * 
   * This method is called during the "commit" phase, so side-effects are permitted.
   * It's the ideal place to log errors to an error reporting service.
   * 
   * @param error - The error that was thrown
   * @param errorInfo - Component stack information
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Here you would log to an error reporting service like Sentry, LogRocket, etc.
    // Example:
    // errorReportingService.captureException(error, {
    //   extra: {
    //     componentStack: errorInfo.componentStack,
    //     errorMessage: error.message,
    //   }
    // });

    // Additional error handling operations can be performed here
    // such as cleaning up resources, state, etc.
  }

  /**
   * Renders either the error UI or children based on error state
   * 
   * @returns The rendered content
   */
  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback UI is provided, render it
      if (fallback) {
        return fallback;
      }

      // Otherwise, render a default error UI using the Alert component
      return (
        <Alert 
          variant="error" 
          className="my-4"
          id="error-boundary-alert"
        >
          <div>
            <h2 className="text-lg font-semibold mb-2">
              Something went wrong
            </h2>
            <p className="text-sm">
              {error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Refresh Page
            </button>
          </div>
        </Alert>
      );
    }

    // If there's no error, render the children normally
    return children;
  }
}

export default ErrorBoundary;