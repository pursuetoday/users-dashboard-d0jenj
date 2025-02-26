/**
 * Context Barrel File for User Management Dashboard
 * 
 * This barrel file exports all React context providers and hooks for authentication and theme management,
 * providing centralized access to application-wide state management solutions with proper TypeScript support.
 * 
 * @packageDocumentation
 * @version 1.0.0
 */

// Re-export authentication context components and hooks
export { default as AuthContext, useAuth, AuthProvider } from './AuthContext';

// Re-export theme context components and hooks
export { ThemeContext, ThemeProvider } from './ThemeContext';