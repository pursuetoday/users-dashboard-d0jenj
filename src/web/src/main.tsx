/**
 * Main entry point for User Management Dashboard
 * 
 * Initializes the React application with React 18 features:
 * - Concurrent rendering with improved performance
 * - Strict mode for identifying potential problems
 * - Error boundaries for graceful error handling
 * - Centralized error monitoring integration
 * - System-preference based theming with user override
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@sentry/react'; // v7.0.0
import { ThemeProvider } from '@mui/material'; // v5.0.0

// Internal imports
import App from './App';
import './styles/index.css';

// DOM element where React will render
const rootElement = document.getElementById('root') as HTMLElement;

// Environment flag for conditional development features
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Initializes application-wide services, monitoring, and configurations
 * Sets up error tracking, performance monitoring, theme, and security headers
 */
function initializeApp(): void {
  // Initialize error monitoring service for production
  if (!isDevelopment && typeof window !== 'undefined') {
    // Dynamically import Sentry to reduce bundle size in development
    import('@sentry/react').then(({ init }) => {
      init({
        dsn: import.meta.env.VITE_SENTRY_DSN || '',
        environment: import.meta.env.MODE,
        // Sample rate for performance monitoring
        tracesSampleRate: 0.2,
        // Capture all errors in production
        sampleRate: 1.0,
      });
    }).catch(err => {
      console.error('Failed to initialize error monitoring:', err);
    });
  }

  // Set up performance monitoring
  if (typeof window !== 'undefined' && 'performance' in window && 'mark' in window.performance) {
    try {
      window.performance.mark('app-init-start');
    } catch (err) {
      console.error('Performance monitoring error:', err);
    }
  }

  // Initialize theme preferences based on user preference or system setting
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const prefersDark = window.matchMedia && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedTheme = localStorage.getItem('theme');
      
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
    } catch (err) {
      console.error('Theme initialization error:', err);
      // Fallback to light theme if there's an error
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('light');
      }
    }
  }
  
  // Set up Content Security Policy headers for production
  if (!isDevelopment && typeof document !== 'undefined' && 
      !document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    try {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.api.com;";
      document.head.appendChild(meta);
    } catch (err) {
      console.error('CSP header setup error:', err);
    }
  }

  // Configure global event listeners for unhandled errors
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      console.error('Uncaught error:', event.error);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
}

/**
 * Creates and renders the React application using React 18's concurrent features
 * Sets up the component tree with appropriate providers and error boundaries
 */
function renderApp(): void {
  // Validate DOM root element existence
  if (!rootElement) {
    throw new Error('Failed to find the root element. Ensure there is a div with id="root" in your HTML.');
  }

  try {
    // Create React 18 root using createRoot for concurrent features
    const root = createRoot(rootElement);

    // Default theme synced with our app's theme system for Material-UI components
    const defaultTheme = {
      palette: {
        mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      },
    };

    // Wrap App with error boundary and theme provider
    const appWithProviders = (
      <React.StrictMode>
        <ErrorBoundary 
          fallback={({ error }) => (
            <div className="p-6 bg-red-50 dark:bg-red-900 rounded-lg max-w-md mx-auto mt-10 text-center">
              <h1 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">
                Something went wrong
              </h1>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {error?.message || 'An unexpected error occurred.'}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Reload application
              </button>
            </div>
          )}
        >
          <ThemeProvider theme={defaultTheme}>
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );

    // Render application with concurrent features
    root.render(appWithProviders);

    // Mark rendering complete for performance measurement
    if (typeof window !== 'undefined' && 'performance' in window && 
        'mark' in window.performance && 'measure' in window.performance) {
      window.performance.mark('app-init-end');
      window.performance.measure('app-initialization', 'app-init-start', 'app-init-end');
    }

    // Set up development tools and HMR
    if (isDevelopment) {
      // Enable hot module replacement for development in Vite
      if (import.meta.hot) {
        import.meta.hot.accept();
      }
    }
  } catch (error) {
    // Catastrophic error handling for rendering failures
    console.error('Fatal error during application rendering:', error);
    
    // Show a basic error message when we can't even render the error boundary
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: sans-serif;">
          <h1 style="color: #e53e3e;">Critical Error</h1>
          <p>The application failed to start. Please try refreshing the page.</p>
          <button 
            onclick="window.location.reload()" 
            style="background-color: #e53e3e; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 20px; cursor: pointer;"
          >
            Reload Page
          </button>
        </div>
      `;
    }
  }
}

// Initialize app-wide services and configurations
initializeApp();

// Render the application
renderApp();