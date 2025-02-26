/**
 * PublicRoute Component
 * 
 * A higher-order component that wraps public routes (login, register, etc.) 
 * and handles authentication-based redirection. It prevents authenticated users 
 * from accessing public routes by redirecting them to the dashboard.
 *
 * @packageDocumentation
 * @version 1.0.0
 */

import { FC, ReactNode, memo, useEffect, useRef } from 'react'; // ^18.0.0
import { Navigate } from 'react-router-dom'; // ^6.0.0

// Internal imports
import { useAuth } from '../hooks/useAuth';
import { PRIVATE_ROUTES } from '../constants/routes.constants';

/**
 * Props interface for the PublicRoute component
 */
export interface PublicRouteProps {
  /** Child components to render if user is not authenticated */
  children: ReactNode;
  
  /** Optional path to redirect authenticated users to (defaults to dashboard) */
  fallbackRoute?: string;
}

/**
 * PublicRoute component enforces that authenticated users cannot access
 * public routes like login or register pages.
 * 
 * @param props - Component props
 * @returns JSX.Element - The route component or a redirect
 */
const PublicRoute: FC<PublicRouteProps> = memo(({ children, fallbackRoute }) => {
  // Extract authentication state from auth hook
  const { isAuthenticated, loading, error } = useAuth();
  
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  
  // Reference to store the previously focused element for a11y
  const previousFocus = useRef<HTMLElement | null>(null);
  
  // Capture previously focused element and handle cleanup
  useEffect(() => {
    // Store currently focused element for returning focus later if needed
    previousFocus.current = document.activeElement as HTMLElement;
    
    return () => {
      // Component cleanup
      isMounted.current = false;
      
      // Restore focus when navigating away for better accessibility
      if (previousFocus.current && typeof previousFocus.current.focus === 'function') {
        previousFocus.current.focus();
      }
    };
  }, []);
  
  // Handle loading state with an accessible loading indicator
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto border-4 border-gray-300 rounded-full border-t-blue-600 animate-spin"></div>
          <p className="mt-4 text-lg text-gray-700">Verifying authentication status...</p>
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50" role="alert" aria-live="assertive">
        <div className="p-6 mx-auto text-center bg-white rounded-lg shadow-lg max-w-md">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
            <svg className="w-6 h-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-800">Authentication Error</h2>
          <p className="mt-2 text-gray-600">{error.message || 'An error occurred while checking authentication status'}</p>
          <button 
            className="px-4 py-2 mt-4 text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // If user is authenticated, redirect to dashboard or specified fallback route
  if (isAuthenticated) {
    // Use fallbackRoute if provided, otherwise default to dashboard
    const redirectTo = fallbackRoute || PRIVATE_ROUTES.DASHBOARD;
    
    return <Navigate to={redirectTo} replace aria-live="polite" />;
  }
  
  // If not authenticated, render children (public route content)
  return <>{children}</>;
});

// Display name for debugging
PublicRoute.displayName = 'PublicRoute';

export default PublicRoute;