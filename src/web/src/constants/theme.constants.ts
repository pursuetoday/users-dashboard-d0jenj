import { ThemeMode } from '../types/theme.types';

/**
 * Key used for storing theme preference in local storage
 * Used to maintain persistent theme selection across sessions
 */
export const THEME_STORAGE_KEY = 'theme';

/**
 * Available theme modes for the application
 * Type-safe mapping of theme modes for consistent theme management
 */
export const THEME_MODES = {
  LIGHT: ThemeMode.LIGHT,
  DARK: ThemeMode.DARK,
  SYSTEM: ThemeMode.SYSTEM
};

/**
 * CSS class names for light and dark themes
 * Integrated with Tailwind's theme system for applying theme styles
 */
export const THEME_CLASSES = {
  LIGHT: 'light',
  DARK: 'dark'
};

/**
 * Default theme configuration
 * Uses system preference as initial mode with light theme fallback
 */
export const DEFAULT_THEME = {
  mode: ThemeMode.SYSTEM,
  isDark: false
};