import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // v11.x
import ErrorIcon from '@mui/icons-material/Error'; // v5.x
import { useTheme } from '@mui/material'; // v5.x
import { withErrorBoundary, withErrorTracking, useErrorTracking } from '@sentry/react'; // v7.x

import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import DashboardLayout from '../../components/layout/DashboardLayout';

/**
 * Props for the ErrorPage component with enhanced error tracking and accessibility support
 */
interface ErrorPageProps {
  /** Error title to display */
  title: string;
  /** Detailed error message */
  message: string;
  /** HTTP status code or error code */
  code: number;
  /** Optional technical error details for debugging */
  technical_details?: string;
  /** Flag to enable retry functionality */
  retry_enabled?: boolean;
  /** Unique identifier for error tracking */
  tracking_id?: string;
}

/**
 * Renders an enhanced error page with theme support, accessibility features, and error tracking
 * 
 * @param props - Component properties
 * @returns Rendered error page component
 */
const ErrorPage: React.FC<ErrorPageProps> = ({
  title,
  message,
  code,
  technical_details,
  retry_enabled = false,
  tracking_id
}) => {
  // Initialize hooks
  const navigate = useNavigate();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const trackError = useErrorTracking();
  
  // Get tailwind theme from custom hook (separate from MUI theme)
  const { theme } = require('../../hooks/useTheme').useTheme();
  
  // Log error to tracking service
  useEffect(() => {
    if (code && message) {
      trackError({
        code,
        message,
        technical_details,
        tracking_id,
        timestamp: new Date().toISOString(),
        location: window.location.href
      });
    }
  }, [code, message, technical_details, tracking_id, trackError]);
  
  /**
   * Handles smart navigation to previous safe page
   */
  const handleNavigateBack = () => {
    // Check if previous page is safe to return to
    const referrer = document.referrer;
    
    // Fall back to dashboard if previous page caused error
    if (!referrer || referrer.includes('/error')) {
      navigate('/dashboard');
    } else {
      // Track navigation attempt
      trackError({
        action: 'navigation_back',
        timestamp: new Date().toISOString()
      });
      
      // Execute navigation
      navigate(-1);
    }
  };
  
  /**
   * Handles navigation to dashboard with error tracking
   */
  const handleNavigateDashboard = () => {
    // Track dashboard navigation attempt
    trackError({
      action: 'navigation_dashboard',
      timestamp: new Date().toISOString()
    });
    
    // Clear error state
    navigate('/dashboard', { replace: true });
  };
  
  /**
   * Handles retry attempt for recoverable errors
   */
  const handleRetry = () => {
    // Check if error is retryable
    if (retry_enabled) {
      // Track retry attempt
      trackError({
        action: 'retry_attempt',
        code,
        timestamp: new Date().toISOString()
      });
      
      // Clear error state
      // Reload required resources
      // Retry failed operation
      window.location.reload();
    }
  };
  
  return (
    <DashboardLayout>
      <div 
        className="flex flex-col items-center justify-center min-h-[70vh] p-4"
        role="alert"
        aria-live="assertive"
      >
        <Card className="max-w-2xl w-full">
          <div className="flex flex-col items-center p-6">
            <ErrorIcon 
              style={{ fontSize: '48px', color: muiTheme.palette.error.main }}
              className="mb-4" 
              aria-hidden="true"
            />
            
            <h1 className="text-2xl font-bold mb-2 text-center">
              {title || t('error.default_title', 'An error occurred')}
            </h1>
            
            <p className="text-center mb-6">
              {message || t('error.default_message', 'We encountered an unexpected problem. Please try again or contact support if the issue persists.')}
            </p>
            
            {technical_details && (
              <details className="mb-6 w-full">
                <summary className="cursor-pointer font-medium text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  {t('error.technical_details', 'Technical Details')}
                </summary>
                <pre className={`p-4 rounded-md text-xs overflow-auto ${theme.isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                  {technical_details}
                </pre>
              </details>
            )}
            
            {tracking_id && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('error.reference_id', 'Reference ID')}: <span className="font-mono">{tracking_id}</span>
              </p>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
              <Button 
                onClick={handleNavigateBack}
                variant="outline"
                size="md"
                fullWidth
                ariaLabel={t('error.go_back', 'Go Back')}
              >
                {t('error.go_back', 'Go Back')}
              </Button>
              
              <Button
                onClick={handleNavigateDashboard}
                variant="primary"
                size="md"
                fullWidth
                ariaLabel={t('error.go_to_dashboard', 'Go to Dashboard')}
              >
                {t('error.go_to_dashboard', 'Go to Dashboard')}
              </Button>
              
              {retry_enabled && (
                <Button
                  onClick={handleRetry}
                  variant="secondary"
                  size="md"
                  fullWidth
                  ariaLabel={t('error.retry', 'Retry')}
                >
                  {t('error.retry', 'Retry')}
                </Button>
              )}
            </div>
            
            <button 
              className="mt-6 text-sm text-gray-500 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={() => window.history.pushState({}, '', '/dashboard')}
              aria-label={t('error.clear_url', 'Clear error from URL')}
            >
              {t('error.clear_url', 'Clear error from URL')}
            </button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

// Apply error tracking and error boundary HOCs
const EnhancedErrorPage = withErrorTracking(withErrorBoundary(ErrorPage));

export default EnhancedErrorPage;