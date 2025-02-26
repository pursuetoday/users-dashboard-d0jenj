import React, { useState } from 'react'; // v18.x
import classNames from 'classnames'; // v2.x

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useTheme } from '../../hooks/useTheme';
import ErrorBoundary from '../common/ErrorBoundary';
import { Theme } from '../../types/theme.types';

/**
 * Props interface for DashboardLayout component
 */
interface DashboardLayoutProps {
  /** Content to render inside the layout */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generates theme-aware Tailwind classes for layout container
 * 
 * @param theme - Current theme state
 * @param isSidebarOpen - Whether the sidebar is currently open
 * @returns Concatenated Tailwind classes for layout container
 */
const getLayoutClasses = (theme: Theme, isSidebarOpen: boolean): string => {
  // Generate base layout classes for flex container and positioning
  const baseClasses = 'min-h-screen flex flex-col';
  
  // Add theme-specific background colors and text colors
  const themeClasses = theme.isDark
    ? 'bg-gray-900 text-white'
    : 'bg-gray-50 text-gray-900';
  
  // Add responsive padding and margin classes based on breakpoints
  const responsiveClasses = '';
  
  // Add transition effects for smooth theme switching
  const transitionClasses = 'transition-colors duration-300';
  
  // Add conditional classes for sidebar state
  const sidebarClasses = '';
  
  // Return combined classes using classNames utility
  return classNames(
    baseClasses,
    themeClasses,
    responsiveClasses,
    transitionClasses,
    sidebarClasses
  );
};

/**
 * Main layout component for authenticated dashboard views with theme support and responsive behavior
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className = '',
}) => {
  // State for sidebar open/closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Get current theme from hook
  const { theme } = useTheme();
  
  /**
   * Toggles the sidebar visibility state with proper accessibility updates
   */
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };
  
  // Get layout classes
  const layoutClasses = getLayoutClasses(theme, isSidebarOpen);
  
  return (
    <ErrorBoundary>
      <div className={classNames(layoutClasses, className)} data-testid="dashboard-layout">
        {/* Top navbar */}
        <Navbar onMenuClick={toggleSidebar} />
        
        {/* Main content with sidebar */}
        <div className="flex flex-1 relative">
          {/* Mobile overlay - only shown on mobile when sidebar is open */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
              onClick={toggleSidebar}
              aria-hidden="true"
            />
          )}
          
          {/* Sidebar */}
          <div 
            className={classNames(
              "fixed md:relative z-30 h-full",
              "transition-transform duration-300 ease-in-out transform",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}
            aria-hidden={!isSidebarOpen}
          >
            <Sidebar 
              isCollapsed={!isSidebarOpen}
              onToggle={toggleSidebar}
              className="h-full"
            />
          </div>
          
          {/* Main content */}
          <main 
            className="flex-1 p-4 sm:p-6 lg:p-8"
            id="main-content"
            role="main"
            aria-label="Main content area"
          >
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        
        {/* Footer */}
        <Footer />
      </div>
    </ErrorBoundary>
  );
};

export default DashboardLayout;