import { ThemeMode } from '../types/theme.types';
import { THEME_MODES, THEME_CLASSES } from '../constants/theme.constants';

/**
 * Media query for detecting system dark mode preference
 * Uses the prefers-color-scheme CSS media feature to detect OS/system theme setting
 */
const MEDIA_QUERY_DARK = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Determines if the system prefers dark mode by checking the prefers-color-scheme media query
 * Handles edge cases and provides fallback for unsupported browsers
 * 
 * @returns True if system prefers dark mode, false for light mode preference or unsupported browsers
 */
const getSystemTheme = (): boolean => {
  try {
    // Check if the browser supports matchMedia and the prefers-color-scheme feature
    return MEDIA_QUERY_DARK.matches;
  } catch (error) {
    // Log the error for debugging but fail gracefully
    console.error('Error detecting system theme preference:', error);
    return false; // Default to light theme if detection fails
  }
};

/**
 * Returns the appropriate CSS class name based on theme mode and system preferences
 * Handles all possible theme modes and ensures consistent class application
 * 
 * @param mode - The selected theme mode (light, dark, or system)
 * @param systemPrefersDark - Whether the system prefers dark mode
 * @returns CSS class name for the selected theme (light or dark)
 */
const getThemeClass = (mode: ThemeMode, systemPrefersDark: boolean): string => {
  // If using system preference
  if (mode === THEME_MODES.SYSTEM) {
    // Return theme class based on system preference
    return systemPrefersDark ? THEME_CLASSES.DARK : THEME_CLASSES.LIGHT;
  }
  
  // For explicit light or dark mode settings
  return mode === THEME_MODES.DARK ? THEME_CLASSES.DARK : THEME_CLASSES.LIGHT;
};

/**
 * Theme configuration object containing utility functions for application-wide theme management
 * Provides methods for detecting system theme and determining appropriate theme classes
 */
export const themeConfig = {
  getSystemTheme,
  getThemeClass,
};