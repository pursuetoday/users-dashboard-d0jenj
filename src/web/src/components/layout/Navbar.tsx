import React, { useState } from 'react'; // v18.x
import classNames from 'classnames'; // v2.x

import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../types/theme.types';

/**
 * Props for Navbar component with enhanced accessibility and mobile support
 */
interface NavbarProps {
  /** Callback function for mobile menu button click */
  onMenuClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label for the navigation */
  ariaLabel?: string;
}

/**
 * Generates Tailwind classes for navbar styling with theme and responsive support
 * 
 * @param theme - Current theme state
 * @param isMenuOpen - Whether the mobile menu is open
 * @returns Concatenated Tailwind classes for navbar with theme and state variations
 */
const getNavbarClasses = (theme: Theme, isMenuOpen: boolean): string => {
  // Generate base navbar classes for positioning and layout
  const baseClasses = 'fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between';
  
  // Add theme-specific background and text colors
  const themeClasses = theme.isDark
    ? 'bg-gray-800 text-white border-gray-700'
    : 'bg-white text-gray-900 border-gray-200';
  
  // Add responsive classes for different screen sizes
  const responsiveClasses = 'sm:px-6 md:px-8';
  
  // Add transition effects for smooth theme switching
  const transitionClasses = 'transition-colors duration-300';
  
  // Add mobile menu state classes
  const stateClasses = isMenuOpen ? 'shadow-lg' : 'shadow-sm';
  
  // Add accessibility-related classes
  const accessibilityClasses = 'print:hidden';
  
  // Add border classes
  const borderClasses = 'border-b';
  
  // Combine all class groups with clean formatting
  return classNames(
    baseClasses,
    themeClasses,
    responsiveClasses,
    transitionClasses,
    stateClasses,
    accessibilityClasses,
    borderClasses
  );
};

/**
 * Top navigation bar component with responsive design, theme support, and accessibility features
 * 
 * Features:
 * - Responsive mobile menu for small screens
 * - Theme toggle with system preference detection and indication
 * - Role-based navigation items for different user types
 * - User authentication status display with login/logout controls
 * - Smooth theme transitions with animation states
 * - Full keyboard navigation and screen reader support
 */
const Navbar: React.FC<NavbarProps> = ({
  onMenuClick,
  className = '',
  ariaLabel = 'Main navigation',
}) => {
  // State for mobile menu
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  // State for theme transition animations
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // Get current theme and toggle function
  const { theme, toggleTheme, systemPreference } = useTheme();
  
  // Get current auth state and logout function
  const { user, logout, isLoading } = useAuth();
  
  /**
   * Handles theme toggle action with system preference and persistence
   */
  const handleThemeToggle = (): void => {
    // Set transition state for animations
    setIsTransitioning(true);
    
    // Call toggleTheme function from theme context
    toggleTheme();
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };
  
  /**
   * Handles user logout action with error handling and loading states
   */
  const handleLogout = async (): Promise<void> => {
    try {
      // Call logout function from auth context
      await logout();
      
      // Redirect to login page on success
      // (This happens automatically in the auth context)
    } catch (error) {
      console.error('Logout failed:', error);
      
      // Error handling with user feedback could be added here
    }
  };
  
  /**
   * Handles mobile menu toggle and notifies parent component
   */
  const handleMenuToggle = (): void => {
    const newState = !isMenuOpen;
    setIsMenuOpen(newState);
    
    // Call external handler if provided
    if (onMenuClick) {
      onMenuClick();
    }
  };
  
  // Generate navbar classes based on current theme and state
  const navbarClasses = getNavbarClasses(theme, isMenuOpen);
  
  return (
    <nav 
      className={classNames(navbarClasses, className)}
      aria-label={ariaLabel}
      role="navigation"
    >
      {/* Logo and Brand */}
      <div className="flex items-center">
        <a href="/" className="flex items-center">
          <svg 
            className={`h-8 w-8 ${theme.isDark ? 'text-blue-400' : 'text-blue-600'}`}
            viewBox="0 0 24 24" 
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" />
          </svg>
          <span className="ml-2 text-lg font-semibold hidden sm:block">
            User Management
          </span>
        </a>
      </div>
      
      {/* Desktop Navigation Links - Only show if authenticated */}
      {user && (
        <div className="hidden md:flex items-center space-x-4">
          <a 
            href="/dashboard" 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              theme.isDark 
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Dashboard
          </a>
          
          {/* Admin and Manager can see Users link */}
          {user.role === 'admin' || user.role === 'manager' ? (
            <a 
              href="/users" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                theme.isDark 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Users
            </a>
          ) : null}
          
          {/* Only Admin can see Settings */}
          {user.role === 'admin' && (
            <a 
              href="/settings" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                theme.isDark 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Settings
            </a>
          )}
        </div>
      )}
      
      {/* Right section: Theme toggle and user menu */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Theme Toggle Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleThemeToggle}
          className={classNames(
            'transition-opacity duration-300',
            isTransitioning ? 'opacity-50' : 'opacity-100'
          )}
          ariaLabel={`Switch to ${theme.isDark ? 'light' : 'dark'} mode`}
        >
          {theme.isDark ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path 
                fillRule="evenodd" 
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" 
                clipRule="evenodd" 
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
          <span className="ml-1 text-xs hidden sm:block">
            {theme.mode === 'system' ? (
              <>
                Auto{' '}
                <span className="text-xs opacity-70">
                  ({systemPreference.isDark ? 'Dark' : 'Light'})
                </span>
              </>
            ) : theme.isDark ? 'Light' : 'Dark'}
          </span>
        </Button>
        
        {/* User Menu or Auth Buttons */}
        {isLoading ? (
          <div className="animate-pulse h-8 w-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
        ) : user ? (
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center"
              onClick={() => {}}
              ariaLabel="User menu"
              ariaExpanded={false}
            >
              <span className="mr-1 hidden sm:block">
                {user.email}
              </span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="ml-2"
              ariaLabel="Log out"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="ml-1 hidden sm:block">Logout</span>
            </Button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <a href="/login">
              <Button variant="primary" size="sm">
                Login
              </Button>
            </a>
            <a href="/register" className="hidden sm:block">
              <Button variant="outline" size="sm">
                Register
              </Button>
            </a>
          </div>
        )}
        
        {/* Mobile Menu Button - Only show if authenticated */}
        {user && (
          <button
            className={`md:hidden inline-flex items-center justify-center p-2 rounded-md ${
              theme.isDark 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            } focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500`}
            onClick={handleMenuToggle}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Main menu"
          >
            <span className="sr-only">{isMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
            {isMenuOpen ? (
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        )}
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && user && (
        <div
          id="mobile-menu"
          className={`md:hidden absolute top-full left-0 right-0 ${
            theme.isDark 
              ? 'bg-gray-800 border-t border-gray-700' 
              : 'bg-white border-t border-gray-200'
          } pb-3 pt-2`}
        >
          <div className="px-2 space-y-1 sm:px-3">
            <a
              href="/dashboard"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                theme.isDark 
                  ? 'text-white bg-gray-900' 
                  : 'text-gray-900 bg-gray-100'
              }`}
            >
              Dashboard
            </a>
            
            {/* Admin and Manager can see Users link */}
            {(user.role === 'admin' || user.role === 'manager') && (
              <a
                href="/users"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  theme.isDark 
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                Users
              </a>
            )}
            
            {/* Only Admin can see Settings */}
            {user.role === 'admin' && (
              <a
                href="/settings"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  theme.isDark 
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                Settings
              </a>
            )}
          </div>
          
          {/* Mobile User Menu */}
          <div className={`pt-4 pb-3 border-t ${
            theme.isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="px-5 flex items-center">
              <div className="flex-shrink-0">
                <svg 
                  className={`h-10 w-10 rounded-full ${
                    theme.isDark ? 'text-gray-400' : 'text-gray-500'
                  }`} 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <div className={`text-base font-medium ${
                  theme.isDark ? 'text-white' : 'text-gray-800'
                }`}>
                  {user.email}
                </div>
                <div className={`text-sm font-medium ${
                  theme.isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {user.role}
                </div>
              </div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <a
                href="/profile"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  theme.isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Your Profile
              </a>
              <button
                className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium ${
                  theme.isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;