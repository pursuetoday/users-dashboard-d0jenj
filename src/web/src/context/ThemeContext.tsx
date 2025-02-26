import { createContext, useEffect, useCallback, useState } from 'react'; // v18.x
import { ThemeMode, Theme, ThemeContextType, ThemeProviderProps } from '../types/theme.types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { THEME_STORAGE_KEY, DEFAULT_THEME } from '../constants/theme.constants';

/**
 * Hook to detect and monitor system theme preference changes
 * @returns {boolean} True if system prefers dark mode, false otherwise
 */
function useSystemTheme(): boolean {
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Handle theme preference change
    const handleChange = (e: MediaQueryListEvent): void => {
      setSystemIsDark(e.matches);
    };

    // Add event listener for changes
    mediaQuery.addEventListener('change', handleChange);
    
    // Clean up event listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return systemIsDark;
}

// Create theme context with default value
const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

/**
 * Theme Provider component
 * Provides theme context with system preference detection and persistence
 * @param {ThemeProviderProps} props Component props
 * @returns {JSX.Element} Provider component
 */
const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Use localStorage to persist theme preference
  const [theme, setTheme] = useLocalStorage<Theme>(THEME_STORAGE_KEY, DEFAULT_THEME);
  
  // Get system theme preference
  const systemIsDark = useSystemTheme();

  // Toggle between light and dark mode
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newMode = prev.mode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK;
      return {
        ...prev,
        mode: newMode,
        isDark: newMode === ThemeMode.DARK,
      };
    });
  }, [setTheme]);

  // Update isDark property based on mode and system preference
  useEffect(() => {
    if (theme.mode === ThemeMode.SYSTEM) {
      setTheme(prev => ({ ...prev, isDark: systemIsDark }));
    }
  }, [theme.mode, systemIsDark, setTheme]);

  // Apply theme class to document element for Tailwind
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    
    if (theme.isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme.isDark]);

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export { ThemeContext, ThemeProvider };