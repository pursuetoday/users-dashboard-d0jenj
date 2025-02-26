import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { PRIVATE_ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import Button from '../common/Button';

// Interface for navigation items
interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  ariaLabel: string;
  mobileLabel: string;
}

// Props for the Sidebar component
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Checks if the given path matches the current route with exact or partial matching
 * 
 * @param path - Route path to check
 * @param exact - Whether to match exactly or as a prefix
 * @returns True if current route matches the path based on matching criteria
 */
const isActiveRoute = (path: string, exact = false): boolean => {
  const location = useLocation();
  
  if (exact) {
    return location.pathname === path;
  }
  
  return location.pathname.startsWith(path);
};

/**
 * Checks if user has permission to access a route based on their role
 * 
 * @param allowedRoles - Array of roles that can access the route
 * @returns True if user has permission
 */
const canAccessRoute = (allowedRoles: string[]): boolean => {
  const { user } = useAuth();
  
  if (!user) return false;
  
  return allowedRoles.includes(user.role);
};

/**
 * Main sidebar navigation component with responsive design and theme support
 */
const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, className = '' }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  
  // Navigation items with role-based access control
  const navigationItems: NavItem[] = [
    {
      path: PRIVATE_ROUTES.DASHBOARD,
      label: 'Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
        </svg>
      ),
      roles: ['admin', 'manager', 'user', 'guest'],
      ariaLabel: 'Go to dashboard',
      mobileLabel: 'Dashboard'
    },
    {
      path: PRIVATE_ROUTES.USERS,
      label: 'Users',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
      roles: ['admin', 'manager'],
      ariaLabel: 'Manage users',
      mobileLabel: 'Users'
    },
    {
      path: PRIVATE_ROUTES.PROFILE,
      label: 'Profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      ),
      roles: ['admin', 'manager', 'user'],
      ariaLabel: 'View your profile',
      mobileLabel: 'Profile'
    },
    {
      path: PRIVATE_ROUTES.SETTINGS,
      label: 'Settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
      roles: ['admin'],
      ariaLabel: 'Manage settings',
      mobileLabel: 'Settings'
    }
  ];
  
  // Filter navigation items based on user role
  const filteredNavItems = user
    ? navigationItems.filter(item => item.roles.includes(user.role))
    : [];
  
  return (
    <aside 
      className={`
        h-full flex flex-col
        transition-all duration-300 ease-in-out
        ${theme.isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 border-r border-gray-200'}
        ${isCollapsed && !isMobile ? 'w-16' : 'w-64'}
        ${className}
      `}
      aria-label="Main navigation"
      data-testid="sidebar"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 flex items-center h-16">
          {isCollapsed && !isMobile ? (
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto">
              U
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold truncate">User Management</h1>
              {isMobile && (
                <button
                  className={`
                    ml-auto p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${theme.isDark 
                      ? 'text-gray-300 hover:text-white focus:ring-blue-500 focus:ring-offset-gray-900' 
                      : 'text-gray-500 hover:text-gray-700 focus:ring-blue-500'}
                  `}
                  onClick={onToggle}
                  aria-label="Close sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-2 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center px-2 py-2 rounded-md text-sm font-medium
                    transition-colors duration-200
                    ${isActive 
                      ? theme.isDark 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-blue-50 text-blue-700' 
                      : theme.isDark 
                        ? 'text-gray-300 hover:bg-gray-800 hover:text-white' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }
                    ${isCollapsed && !isMobile ? 'justify-center' : ''}
                  `}
                  aria-label={item.ariaLabel}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className={isActive 
                    ? theme.isDark ? 'text-white' : 'text-blue-600'
                    : theme.isDark ? 'text-gray-400' : 'text-gray-500'
                  }>
                    {item.icon}
                  </div>
                  {(!isCollapsed || isMobile) && (
                    <span className="ml-3 truncate">
                      {isMobile ? item.mobileLabel : item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        
        {/* Footer */}
        <div className={`p-4 space-y-2 border-t ${theme.isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {/* Theme Toggle */}
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={toggleTheme}
            ariaLabel={`Switch to ${theme.isDark ? 'light' : 'dark'} mode`}
            className={`
              ${isCollapsed && !isMobile ? 'justify-center' : ''}
              ${theme.isDark 
                ? 'border-gray-700 hover:bg-gray-800' 
                : 'hover:bg-gray-100'}
            `}
          >
            {theme.isDark ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                {(!isCollapsed || isMobile) && <span className="ml-2">Light Mode</span>}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                {(!isCollapsed || isMobile) && <span className="ml-2">Dark Mode</span>}
              </>
            )}
          </Button>
          
          {/* Logout Button - Only shown when user is authenticated */}
          {user && (
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={logout}
              ariaLabel="Logout from your account"
              className={`
                ${isCollapsed && !isMobile ? 'justify-center' : ''}
                ${theme.isDark 
                  ? 'border-gray-700 hover:bg-red-900 hover:border-red-900' 
                  : 'hover:bg-red-50 hover:text-red-700 hover:border-red-200'}
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10 8a1 1 0 01-1 1H7.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 1.414L7.414 10H12a1 1 0 011 1z" clipRule="evenodd" />
              </svg>
              {(!isCollapsed || isMobile) && <span className="ml-2">Logout</span>}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;