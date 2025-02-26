/**
 * Main Routing Configuration for User Management Dashboard
 * 
 * Implements the application's route structure with:
 * - Secure authentication flows
 * - Role-based access control
 * - Code splitting and lazy loading
 * - Accessibility features
 * - Route-level error boundaries
 * - Analytics tracking
 * - SEO optimization
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // ^6.0.0
import { lazy, Suspense, memo } from 'react'; // ^18.0.0
import { Analytics, AnalyticsProvider } from '@analytics/react'; // ^1.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { CircularProgress as LoadingSpinner } from '@mui/material'; // ^5.0.0
import { Helmet as SEOHead } from 'react-helmet-async'; // ^5.0.0

// Internal imports
import PrivateRoute from './PrivateRoute';
import { useAuth } from '../context/AuthContext';
import { PRIVATE_ROUTES, PUBLIC_ROUTES, ERROR_ROUTES } from '../constants/routes.constants';
import { UserRole } from '../types/auth.types';

// Analytics configuration for route tracking
const analyticsConfig = {
  app: 'user-management-dashboard',
  plugins: [
    // Configure analytics plugins as needed
  ]
};

// Role-based route configuration
const ROLE_ROUTES = {
  [UserRole.ADMIN]: [
    PRIVATE_ROUTES.DASHBOARD,
    PRIVATE_ROUTES.USERS,
    PRIVATE_ROUTES.PROFILE,
    PRIVATE_ROUTES.SETTINGS,
  ],
  [UserRole.MANAGER]: [
    PRIVATE_ROUTES.DASHBOARD,
    PRIVATE_ROUTES.USERS,
    PRIVATE_ROUTES.PROFILE,
  ],
  [UserRole.USER]: [
    PRIVATE_ROUTES.DASHBOARD,
    PRIVATE_ROUTES.PROFILE,
  ],
  [UserRole.GUEST]: [
    PRIVATE_ROUTES.DASHBOARD,
  ]
};

// Lazy loaded route components for code splitting
const Dashboard = lazy(() => import('../pages/Dashboard'));
const UserManagement = lazy(() => import('../pages/UserManagement'));
const UserProfile = lazy(() => import('../pages/UserProfile'));
const Settings = lazy(() => import('../pages/Settings'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const NotFound = lazy(() => import('../pages/NotFound'));
const ErrorPage = lazy(() => import('../pages/Error'));

/**
 * Custom component to handle route-based SEO
 */
const RouteBasedSEO = () => {
  const location = useLocation();
  
  // Define page titles and descriptions based on route
  const getPageMetadata = () => {
    const path = location.pathname;
    
    if (path === PUBLIC_ROUTES.LOGIN) {
      return {
        title: 'Login | User Management Dashboard',
        description: 'Log in to access the User Management Dashboard'
      };
    } else if (path === PUBLIC_ROUTES.REGISTER) {
      return {
        title: 'Register | User Management Dashboard',
        description: 'Create a new account for the User Management Dashboard'
      };
    } else if (path === PRIVATE_ROUTES.DASHBOARD) {
      return {
        title: 'Dashboard | User Management Dashboard',
        description: 'Main dashboard for User Management'
      };
    } else if (path.startsWith(PRIVATE_ROUTES.USERS)) {
      return {
        title: 'User Management | User Management Dashboard',
        description: 'Manage user accounts and permissions'
      };
    } else if (path === PRIVATE_ROUTES.PROFILE) {
      return {
        title: 'Profile | User Management Dashboard',
        description: 'Your user profile and settings'
      };
    } else if (path === PRIVATE_ROUTES.SETTINGS) {
      return {
        title: 'Settings | User Management Dashboard',
        description: 'System configuration and settings'
      };
    } else if (path === ERROR_ROUTES.NOT_FOUND) {
      return {
        title: 'Page Not Found | User Management Dashboard',
        description: 'The requested page could not be found'
      };
    }
    
    // Default metadata
    return {
      title: 'User Management Dashboard',
      description: 'Secure, centralized platform for managing user data and authentication'
    };
  };
  
  const metadata = getPageMetadata();
  
  return (
    <SEOHead>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta property="og:title" content={metadata.title} />
      <meta property="og:description" content={metadata.description} />
      <meta property="og:url" content={window.location.href} />
      <meta name="twitter:title" content={metadata.title} />
      <meta name="twitter:description" content={metadata.description} />
      <link rel="canonical" href={window.location.href} />
    </SEOHead>
  );
};

/**
 * Fallback loading component with accessibility features
 */
const AccessibleLoadingFallback = () => (
  <div 
    className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900"
    role="alert"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="text-center">
      <LoadingSpinner 
        size={60} 
        aria-label="Loading content" 
        className="text-blue-600 dark:text-blue-400"
      />
      <p className="mt-4 text-gray-700 dark:text-gray-300 text-lg">
        Loading content...
      </p>
    </div>
  </div>
);

/**
 * Custom error fallback component for route errors
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded text-left overflow-auto text-sm mb-4 max-h-40">
          {error.stack?.split('\n').slice(0, 3).join('\n') || 'No error details available'}
        </pre>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = PUBLIC_ROUTES.LOGIN}
            className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Return to login
          </button>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Route validator component that checks if the user has permission to access a route
 * based on their role and the role-based route configuration
 */
const RoleBasedRoute = memo(({ children }) => {
  const { authState } = useAuth();
  const location = useLocation();
  
  if (!authState.isAuthenticated || !authState.user) {
    return <Navigate to={PUBLIC_ROUTES.LOGIN} state={{ from: location.pathname }} replace />;
  }
  
  const userRole = authState.user.role;
  const allowedRoutes = ROLE_ROUTES[userRole] || [];
  
  // Check if current path is allowed for user's role
  const isAllowed = allowedRoutes.some(route => location.pathname.startsWith(route));
  
  if (!isAllowed) {
    // Redirect to the first allowed route for this user's role
    const defaultRoute = allowedRoutes[0] || PUBLIC_ROUTES.LOGIN;
    return <Navigate to={defaultRoute} replace />;
  }
  
  return <>{children}</>;
});

/**
 * Main routing component implementing secure route configuration with
 * code splitting, error boundaries, and accessibility features
 */
const AppRoutes = memo((): JSX.Element => {
  // Analytics page view tracking
  const trackPageView = () => {
    if (window.location) {
      Analytics.page({
        url: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
        title: document.title
      });
    }
  };

  return (
    <AnalyticsProvider instance={Analytics} config={analyticsConfig}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <BrowserRouter>
          <RouteBasedSEO />
          <Suspense fallback={<AccessibleLoadingFallback />}>
            <Routes>
              {/* Public routes - accessible without authentication */}
              <Route path={PUBLIC_ROUTES.LOGIN} element={<Login />} />
              <Route path={PUBLIC_ROUTES.REGISTER} element={<Register />} />
              <Route path={PUBLIC_ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
              <Route path={PUBLIC_ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
              
              {/* Protected routes - require authentication */}
              <Route element={<PrivateRoute />}>
                <Route element={<RoleBasedRoute />}>
                  <Route path={PRIVATE_ROUTES.DASHBOARD} element={<Dashboard />} />
                  <Route path={PRIVATE_ROUTES.USERS} element={<UserManagement />} />
                  <Route path={PRIVATE_ROUTES.PROFILE} element={<UserProfile />} />
                  <Route path={PRIVATE_ROUTES.SETTINGS} element={<Settings />} />
                </Route>
              </Route>
              
              {/* Error routes */}
              <Route path={ERROR_ROUTES.NOT_FOUND} element={<NotFound />} />
              <Route path={ERROR_ROUTES.ERROR} element={<ErrorPage />} />
              
              {/* Default redirect - send to dashboard if logged in, login page otherwise */}
              <Route path="/" element={
                <Navigate to={PRIVATE_ROUTES.DASHBOARD} replace />
              } />
              
              {/* Catch-all route for 404 */}
              <Route path="*" element={<Navigate to={ERROR_ROUTES.NOT_FOUND} replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </AnalyticsProvider>
  );
});

export default AppRoutes;