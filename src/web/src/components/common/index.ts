/**
 * @fileoverview Common UI components barrel file
 * 
 * This file re-exports all common UI components and their TypeScript interfaces,
 * providing a single import point for consistent component usage across the application.
 * All components follow the Tailwind UI design system with proper type definitions.
 */

// Import components and their TypeScript interfaces
import Alert, { AlertProps } from './Alert';
import BadgeDefault, { BadgeProps } from './Badge';

/**
 * Record type for mapping component names to their React functional component implementations
 * Used for component collections and dynamic component rendering
 */
export type CommonComponents = Record<string, React.FC<any>>;

/**
 * Record type for mapping component names to their props interfaces
 * Useful for props documentation and programmatic component usage
 */
export type CommonProps = Record<string, any>;

// Re-export Badge as a named export for consistent import patterns
export const Badge = BadgeDefault;

// Re-export Alert component and all TypeScript interfaces
export {
  Alert,
  AlertProps,
  BadgeProps,
};

// Default export with all components for convenience when importing multiple components
const components = {
  Alert,
  Badge,
};

export default components;