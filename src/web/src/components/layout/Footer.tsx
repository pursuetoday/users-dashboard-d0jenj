import { FC } from 'react'; // v18.x
import { useTheme } from '../../hooks/useTheme';

/**
 * Footer component that displays copyright information and theme-aware styling
 * for the application layout with responsive design and accessibility considerations.
 * 
 * Features:
 * - Dynamic theme-aware styling that adapts to light/dark mode preferences
 * - Responsive layout with mobile-first approach using Tailwind breakpoints
 * - Semantic HTML structure for better accessibility (WCAG 2.1 Level AA compliance)
 * - Current year copyright information with proper attribution
 * - Smooth transitions between theme changes
 *
 * @returns {JSX.Element} Rendered footer component with theme-aware styling and responsive layout
 */
const Footer: FC = () => {
  // Access current theme state using useTheme hook
  const { theme } = useTheme();
  
  // Get current year for copyright text
  const currentYear = new Date().getFullYear();
  
  return (
    <footer 
      className="
        w-full 
        py-4 
        mt-auto
        transition-colors duration-300 ease-in-out
        bg-gray-100 dark:bg-gray-800 
        text-gray-700 dark:text-gray-200
        border-t border-gray-200 dark:border-gray-700
      "
      aria-label="Site footer"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center">
        <div className="text-sm md:text-base mb-2 sm:mb-0">
          <span aria-label={`Copyright ${currentYear}`}>&copy; {currentYear}</span>{' '}
          <span className="font-medium">User Management Dashboard</span>
          <span className="ml-1">All rights reserved.</span>
        </div>
        
        <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
          <span>Version 1.0.0</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;