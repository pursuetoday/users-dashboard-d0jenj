/**
 * Registration Page Component
 * 
 * Public page component that renders the user registration interface within an authentication layout,
 * with comprehensive accessibility features and SEO optimization.
 * 
 * Features:
 * - WCAG 2.1 Level AA compliance
 * - Comprehensive SEO optimization with Helmet
 * - Skip navigation for improved accessibility
 * - Error boundary for graceful error handling
 * - Analytics tracking
 * - Public route protection (redirects authenticated users)
 *
 * @packageDocumentation
 * @version 1.0.0
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import RegisterForm from '../../components/auth/RegisterForm';
import AuthLayout from '../../components/layout/AuthLayout';
import PublicRoute from '../../routes/PublicRoute';
import { PUBLIC_ROUTES } from '../../constants/routes.constants';

/**
 * RegisterPage component renders the registration form within a protected public route
 * and authentication layout with accessibility and SEO enhancements.
 * 
 * @returns {JSX.Element} Register page with proper accessibility attributes and SEO metadata
 */
const RegisterPage: React.FC = () => {
  // Track page view for analytics
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // @ts-ignore - gtag may not be in Window interface
      window.gtag('event', 'page_view', {
        page_title: 'Registration',
        page_path: PUBLIC_ROUTES.REGISTER,
        page_location: window.location.href
      });
    }
  }, []);

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="p-6 max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
              Registration Page Error
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {error?.message || "We're sorry, but we encountered an error loading the registration page."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Reload page to try again"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    >
      <PublicRoute>
        {/* SEO Optimization */}
        <Helmet>
          <title>Create Account | User Management Dashboard</title>
          <meta name="description" content="Register for a new account to access the User Management Dashboard with powerful user administration tools." />
          <meta name="robots" content="noindex, nofollow" /> {/* Typically registration pages are not indexed */}
          <link rel="canonical" href={`${window.location.origin}${PUBLIC_ROUTES.REGISTER}`} />
          <meta property="og:title" content="Create a New Account" />
          <meta property="og:description" content="Sign up for the User Management Dashboard to start managing users efficiently." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`${window.location.origin}${PUBLIC_ROUTES.REGISTER}`} />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="Create a New Account | User Management Dashboard" />
          <meta name="twitter:description" content="Sign up for the User Management Dashboard to start managing users efficiently." />
        </Helmet>

        {/* Skip Navigation Link for Accessibility */}
        <a 
          href="#register-form" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-blue-600 p-2 z-50 rounded shadow"
          aria-label="Skip to registration form"
        >
          Skip to registration form
        </a>

        {/* Registration Page Content */}
        <AuthLayout title="Create an Account">
          <div id="register-form" tabIndex={-1} aria-labelledby="register-heading">
            <h1 id="register-heading" className="sr-only">
              Register for a New Account
            </h1>
            <RegisterForm />
          </div>
        </AuthLayout>
      </PublicRoute>
    </ErrorBoundary>
  );
};

export default RegisterPage;