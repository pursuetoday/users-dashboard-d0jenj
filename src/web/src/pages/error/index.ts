/**
 * Centralized export module for error-related page components
 * 
 * This file provides a unified interface for accessing error handling pages
 * with TypeScript support, error tracking capabilities, and accessibility compliance.
 * All error-related page components should be exported from this file to maintain
 * consistent error handling patterns throughout the application.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// Export ErrorPage component with its TypeScript interface
export { default as ErrorPage } from './ErrorPage';
export type { ErrorPageProps } from './ErrorPage';

// Export NotFoundPage component for 404 error handling
export { default as NotFoundPage } from './NotFoundPage';