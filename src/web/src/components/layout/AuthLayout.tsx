import React, { useEffect } from 'react';
import classNames from 'classnames'; // v2.x
import Card from '../common/Card';
import { useTheme } from '../../hooks/useTheme';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props for the AuthLayout component
 */
interface AuthLayoutProps {
  /** Content to be rendered inside the layout */
  children: React.ReactNode;
  /** Optional title for the auth page */
  title?: string;
  /** Additional CSS classes to apply to the layout */
  className?: string;
  /** Data test ID for testing */
  testId?: string;
}

/**
 * Renders a themed, accessible layout container for authentication pages
 * with centered content, responsive design, and error handling.
 * 
 * This component provides a consistent layout for authentication-related
 * pages including login, registration, and password reset forms with:
 * - Responsive, centered layout with appropriate spacing
 * - Theme-aware styling that adapts to system preferences
 * - Accessibility features including proper ARIA attributes
 * - Error boundary for graceful error handling
 * - Beautiful gradient background with theme transitions
 * 
 * @param {AuthLayoutProps} props - Component properties
 * @returns {JSX.Element} Rendered authentication layout with theme support and error boundary
 */
const AuthLayout = React.memo<AuthLayoutProps>(({
  children,
  title,
  className = '',
  testId = 'auth-layout'
}: AuthLayoutProps): JSX.Element => {
  // Get current theme from context
  const { theme } = useTheme();
  
  // Clean up any theme transition effects when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup function for any side effects
    };
  }, []);
  
  // Container classes with theme-aware styling
  const containerClasses = classNames(
    // Full viewport height and width with centered content
    'min-h-screen w-full flex items-center justify-center py-8 sm:py-12',
    // Theme-specific background with gradient
    // Using multiple color stops for more interesting visual effect
    theme.isDark 
      ? 'bg-gradient-to-br from-gray-900 via-indigo-950 to-blue-900' 
      : 'bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-50',
    // Background opacity to allow for pattern visibility
    'bg-opacity-95',
    // Smooth transitions for theme changes
    'transition-all duration-300 ease-in-out',
    // Add custom class names passed as props
    className
  );
  
  // Content container classes for responsive layout
  const contentClasses = classNames(
    // Full width with maximum constraint and responsive padding
    'w-full max-w-md px-4 sm:px-6',
    // Center horizontally 
    'mx-auto'
  );
  
  return (
    <ErrorBoundary>
      <main 
        className={containerClasses}
        data-testid={testId}
        aria-labelledby={title ? 'auth-title' : undefined}
      >
        <div className={contentClasses}>
          <Card 
            variant="elevated" 
            className="w-full shadow-md sm:shadow-lg"
          >
            {title && (
              <h1 
                id="auth-title"
                className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-center"
              >
                {title}
              </h1>
            )}
            {children}
          </Card>
        </div>
      </main>
    </ErrorBoundary>
  );
});

// Add display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;