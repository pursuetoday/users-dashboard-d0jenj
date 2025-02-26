import { ReactNode } from 'react'; // v18.x

/**
 * Available theme modes for the application
 * - LIGHT: Light mode theme
 * - DARK: Dark mode theme
 * - SYSTEM: Uses system preference for theme
 */
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * Theme state configuration
 * @property mode - Current theme mode (light, dark, or system)
 * @property isDark - Boolean indicating if dark mode is active
 */
export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
}

/**
 * Theme context type definition
 * Provides theme state management and operations throughout the application
 * @property theme - Current theme state
 * @property setTheme - Function to update theme state
 * @property toggleTheme - Function to toggle between light and dark modes
 */
export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Props for ThemeProvider component
 * @property children - React components to be wrapped by the provider
 */
export interface ThemeProviderProps {
  children: ReactNode;
}