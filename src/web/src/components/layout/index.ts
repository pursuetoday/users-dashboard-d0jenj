/**
 * Layout Components Barrel File
 * 
 * This file exports all layout components for the User Management Dashboard,
 * providing a centralized entry point for layout-related components with
 * comprehensive type definitions and documentation.
 * 
 * These components implement the specified layout requirements including authentication wrapper,
 * dashboard layout, and navigation components following the defined component hierarchy
 * for proper organization and type safety.
 */

// Import default exports from component files
import AuthLayout from './AuthLayout';
import DashboardLayout from './DashboardLayout'; 
import Footer from './Footer';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

// Re-export as named exports with documentation

/**
 * Layout wrapper for authentication pages with centered content and background styling.
 * 
 * Features:
 * - Centered card layout with full viewport height
 * - Theme-aware background with gradient
 * - Responsive padding and margins
 * - Error boundary integration
 */
export { AuthLayout };

/**
 * Main layout for authenticated dashboard views with navigation and content areas.
 * 
 * Features:
 * - Fixed navbar at the top
 * - Responsive sidebar with collapsible menu
 * - Main content area with appropriate padding
 * - Footer component integration
 * - Theme-aware styling
 */
export { DashboardLayout };

/**
 * Footer component for consistent application layout and branding.
 * 
 * Features:
 * - Copyright information with current year
 * - Version information
 * - Responsive layout
 * - Theme-aware styling
 */
export { Footer };

/**
 * Top navigation component with user controls and system navigation.
 * 
 * Features:
 * - User menu with authentication status
 * - Theme toggle
 * - Mobile responsiveness
 * - Role-based navigation items
 */
export { Navbar };

/**
 * Navigation sidebar component with role-based menu items and collapse functionality.
 * 
 * Features:
 * - Collapsible/expandable sidebar
 * - Role-based navigation items
 * - Theme integration
 * - Mobile-first responsive design
 */
export { Sidebar };