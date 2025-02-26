import React, { memo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom'; // ^6.0.0
import logger from '@logger/core'; // ^1.0.0

// Internal imports
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { PUBLIC_ROUTES } from '../constants/routes.constants';

/**
 * Higher-order component that protects routes requiring authentication.
 * Validates user authentication state and redirects unauthorized users to login.
 * Implements loading states and security monitoring for unauthorized access attempts.
 * 
 * @returns Protected route content, loading spinner, or login redirect based on authentication state
 */
const PrivateRoute = memo((): JSX.Element => {
  // Get authentication state from context
  const { authState } = useAuth();
  const { isAuthenticated, loading, error } = authState;
  
  // Get current location for redirect handling
  const location = useLocation();
  
  // Log unauthorized access attempts for security monitoring
  if (!loading && !isAuthenticated) {
    logger.warn('Unauthorized access attempt', {
      path: location.pathname,
      timestamp: new Date().toISOString(),
      result: 'redirecting to login'
    });
  }

  // Handle and log authentication errors or failures
  if (error) {
    logger.error('Authentication error in PrivateRoute', {
      message: error.message,
      code: error.code,
      timestamp: error.timestamp || new Date().toISOString(),
      path: location.pathname
    });
  }
  
  // Display loading spinner while authentication state is being determined
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Redirect to login page with return URL if user is not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={PUBLIC_ROUTES.LOGIN} 
        state={{ from: location.pathname }} 
        replace
      />
    );
  }
  
  // Render protected route content using Outlet if user is authenticated
  return <Outlet />;
});

export default PrivateRoute;