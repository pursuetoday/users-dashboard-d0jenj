import { useContext } from 'react'; // v18.x
import { ThemeContext } from '../context/ThemeContext';
import { ThemeContextType } from '../types/theme.types';

/**
 * Custom React hook that provides type-safe access to theme context and theme management functions.
 * This hook must be used within a ThemeProvider component hierarchy.
 * 
 * Features:
 * - Type-safe theme state and operations
 * - System preference detection and synchronization
 * - Persistent theme selection using localStorage
 * - Integration with Tailwind UI theme system
 * 
 * @returns {ThemeContextType} Object containing:
 *  - theme: Current theme state with mode and isDark flag
 *  - setTheme: Function to update theme state
 *  - toggleTheme: Function to toggle between light and dark modes
 * 
 * @throws {Error} If used outside a ThemeProvider component
 * 
 * @example
 * // Basic usage to access current theme
 * const { theme } = useTheme();
 * 
 * // Use in a component
 * return (
 *   <div className="text-gray-900 dark:text-white">
 *     Current theme: {theme.isDark ? 'Dark' : 'Light'}
 *   </div>
 * );
 * 
 * @example
 * // Toggle between light and dark modes
 * const { toggleTheme } = useTheme();
 * 
 * return (
 *   <button 
 *     onClick={toggleTheme}
 *     className="p-2 rounded bg-gray-200 dark:bg-gray-800"
 *   >
 *     Toggle Theme
 *   </button>
 * );
 * 
 * @example
 * // Set a specific theme
 * const { setTheme } = useTheme();
 * import { ThemeMode } from '../types/theme.types';
 * 
 * const setDarkMode = () => {
 *   setTheme({ mode: ThemeMode.DARK, isDark: true });
 * };
 * 
 * const setSystemTheme = () => {
 *   // System preference is handled automatically by the ThemeProvider
 *   setTheme({ mode: ThemeMode.SYSTEM, isDark: false });
 * };
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (context === null || context === undefined) {
    throw new Error(
      'useTheme: Theme context is not available. ' +
      'Make sure the component is wrapped in a ThemeProvider component. ' +
      'This error occurs when the hook is used outside of the ThemeProvider component tree.'
    );
  }
  
  return context;
}