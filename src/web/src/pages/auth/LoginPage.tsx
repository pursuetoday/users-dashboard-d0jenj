import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import useAnalytics from '@analytics/react'; // ^0.1.0
import ErrorBoundary from 'react-error-boundary'; // ^4.0.0

import AuthLayout from '../../components/layout/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { AuthUser } from '../../types/auth.types';

/**
 * Memoized login page component that renders the authentication layout and login form 
 * with error handling and analytics integration.
 * 
 * @returns {JSX.Element} Rendered login page with error boundary
 */
const LoginPage: React.FC = React.memo(() => {
  // Initialize navigate function from useNavigate hook
  const navigate = useNavigate();
  
  // Get authentication state and loading state from useAuth hook
  const { isAuthenticated, loading } = useAuth();
  
  // Get current theme from useTheme hook
  const { theme } = useTheme();
  
  // Initialize analytics tracking
  const analytics = useAnalytics();

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Track page view and interaction events
  useEffect(() => {
    analytics.track('page_view', { 
      page_name: 'login',
      theme: theme.mode
    });
  }, [analytics, theme.mode]);

  /**
   * Callback function to handle successful login with analytics tracking
   */
  const handleLoginSuccess = (user: AuthUser): void => {
    // Track successful login event
    analytics.track('login_success', {
      user_id: user.id,
      user_role: user.role
    });
    
    // Navigate to dashboard route
    navigate('/dashboard');
    
    // Log successful authentication for monitoring
    console.info('User successfully authenticated');
  };

  // Show loading state while authentication status is being checked
  if (loading) {
    return (
      <AuthLayout title="Authenticating..." testId="login-page-loading">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <AuthLayout title="Login Error" testId="login-page-error">
          <div className="p-4 bg-red-50 text-red-700 rounded-md">
            <h3 className="font-semibold">An error occurred</h3>
            <p className="mt-2">{error.message || 'Please try again or contact support if the issue persists.'}</p>
            <button 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </AuthLayout>
      )}
    >
      <AuthLayout title="Sign In to User Management Dashboard" testId="login-page">
        <LoginForm 
          onSuccess={handleLoginSuccess}
          aria-label="Login Form"
          aria-describedby="login-instructions"
          validationMode="onChange"
          rateLimitAttempts={5}
        />
      </AuthLayout>
    </ErrorBoundary>
  );
});

// Add display name for debugging
LoginPage.displayName = 'LoginPage';

export default LoginPage;