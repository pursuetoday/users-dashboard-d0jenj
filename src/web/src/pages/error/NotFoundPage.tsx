import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.x
import * as ErrorTracking from '@sentry/react'; // v7.x
import * as ErrorBoundary from 'react-error-boundary'; // v4.x

import Button from '../../components/common/Button';
import AuthLayout from '../../components/layout/AuthLayout';
import { PRIVATE_ROUTES } from '../../constants/routes.constants';
import { useTheme } from '../../hooks/useTheme';

/**
 * Renders an accessible 404 Not Found error page with theme support and error tracking
 * 
 * @returns {JSX.Element} Rendered error page component with proper semantic structure
 */
const NotFoundPage: React.FC = () => {
  // Initialize navigate function from useNavigate hook
  const navigate = useNavigate();
  
  // Initialize theme context from useTheme hook
  const { theme } = useTheme();
  
  // Set up error tracking context
  useEffect(() => {
    // Track 404 occurrence in analytics
    ErrorTracking.captureMessage("User encountered 404 page", {
      level: 'info',
      tags: { 
        source: 'NotFoundPage',
        isDarkMode: theme.isDark 
      }
    });
    
    // Set page title and meta description for SEO
    document.title = 'Page Not Found | User Management Dashboard';
    
    // Manage focus for accessibility
    const mainContent = document.getElementById('not-found-content');
    if (mainContent) {
      mainContent.focus();
    }
    
    return () => {
      // Clean up on unmount
    };
  }, [theme.isDark]);
  
  /**
   * Handles navigation back to dashboard with keyboard support
   * 
   * @param {React.KeyboardEvent | React.MouseEvent} event - The triggering event
   */
  const handleReturn = (event: React.KeyboardEvent | React.MouseEvent) => {
    // Check if event is keyboard event and key is not Enter
    if (
      event.nativeEvent instanceof KeyboardEvent && 
      (event as React.KeyboardEvent).key !== 'Enter'
    ) {
      return; // Only proceed for mouse clicks or Enter key
    }
    
    // Track navigation attempt in analytics
    ErrorTracking.addBreadcrumb({
      category: 'user-action',
      message: 'User navigated from 404 page to dashboard',
      level: 'info'
    });
    
    // Call navigate function with DASHBOARD route path
    navigate(PRIVATE_ROUTES.DASHBOARD);
    
    // Update focus management system
    // Focus will be managed by the dashboard component when it mounts
  };
  
  return (
    // Render AuthLayout with proper ARIA landmarks
    <AuthLayout 
      title="Page Not Found" 
      testId="not-found-page"
    >
      {/* Display semantically structured error content */}
      <div 
        id="not-found-content"
        className="flex flex-col items-center text-center"
        aria-labelledby="not-found-heading"
        role="alert"
        aria-live="polite"
        tabIndex={-1} // Allow programmatic focus but not tab order
      >
        {/* Visual indicator of error */}
        <div className="mb-6" aria-hidden="true">
          <svg 
            className={`w-24 h-24 ${theme.isDark ? 'text-blue-300' : 'text-blue-500'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        {/* Error heading */}
        <h1 
          id="not-found-heading"
          className="text-2xl font-bold mb-2"
        >
          404 - Page Not Found
        </h1>
        
        {/* Error description */}
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        {/* Implement keyboard navigation handlers */}
        <Button 
          variant="primary"
          onClick={handleReturn}
          onKeyDown={handleReturn}
          className="mt-2"
          ariaLabel="Return to dashboard"
          ariaDescribedBy="return-description"
        >
          Return to Dashboard
        </Button>
        <span id="return-description" className="sr-only">
          Navigate back to the dashboard page
        </span>
      </div>
    </AuthLayout>
  );
};

// Apply error tracking with Sentry profiler
const ProfiledNotFoundPage = ErrorTracking.withProfiler(NotFoundPage, {
  name: 'NotFoundPage'
});

// Add error boundary wrapper for component error handling
const EnhancedNotFoundPage = ErrorBoundary.withErrorBoundary(ProfiledNotFoundPage, {
  fallback: (
    <AuthLayout title="Something Went Wrong">
      <div className="text-center">
        <p className="mb-4">Something went wrong while loading this page.</p>
        <Button 
          variant="primary" 
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
    </AuthLayout>
  ),
  onError: (error, info) => {
    ErrorTracking.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack
        }
      }
    });
  }
});

export default EnhancedNotFoundPage;