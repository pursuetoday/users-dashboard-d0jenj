import React, { useState, useEffect, useCallback, SVGProps } from 'react';
import { Switch } from '@headlessui/react'; // v1.x
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import { useTheme } from '../../hooks/useTheme';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { Theme, ThemeMode } from '../../types/theme.types';

/**
 * Interface for SettingsSection component props
 */
interface SettingsSection {
  title: string;
  description: string;
  children: React.ReactNode;
  icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  testId: string;
}

/**
 * Interface for theme preference settings
 */
interface ThemePreference {
  theme: Theme;
  useSystemPreference: boolean;
}

/**
 * Reusable SettingsSection component for consistent styling across settings blocks
 */
const SettingsSection: React.FC<SettingsSection> = ({
  title,
  description,
  children,
  icon: Icon,
  testId
}) => {
  return (
    <Card className="mb-6" data-testid={testId}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-1">
          <Icon className="h-6 w-6 text-blue-500 dark:text-blue-400" aria-hidden="true" />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
};

/**
 * Custom hook for managing settings persistence
 */
const useSettingsPersistence = (initialSettings: ThemePreference) => {
  const [settings, setSettings] = useState<ThemePreference>(initialSettings);
  const [error, setError] = useState<string | null>(null);
  
  // Load settings from local storage on component mount
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('userSettings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        
        // Validate the data structure
        if (typeof parsedSettings === 'object' && 
            parsedSettings !== null &&
            'theme' in parsedSettings && 
            'useSystemPreference' in parsedSettings) {
          setSettings(parsedSettings);
        } else {
          console.warn('Invalid settings format in localStorage, using defaults');
        }
      }
      setError(null);
    } catch (error) {
      console.error('Failed to load settings from local storage:', error);
      setError('Failed to load your preferences. Using default settings.');
    }
  }, []);
  
  // Save settings to local storage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('userSettings', JSON.stringify(settings));
      setError(null);
    } catch (error) {
      console.error('Failed to save settings to local storage:', error);
      setError('Failed to save your preferences. Changes may not persist.');
    }
  }, [settings]);
  
  // Update settings with validation
  const updateSettings = useCallback((newSettings: Partial<ThemePreference>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  }, []);
  
  // Handle system preference sync
  const syncWithSystemPreference = useCallback(() => {
    if (settings.useSystemPreference) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      updateSettings({ 
        theme: { 
          ...settings.theme, 
          isDark: prefersDark,
          mode: ThemeMode.SYSTEM
        } 
      });
    }
  }, [settings, updateSettings]);
  
  return {
    settings,
    updateSettings,
    syncWithSystemPreference,
    error
  };
};

// Icons for settings sections
const ThemeIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
);

const UserIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const NotificationIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
  </svg>
);

const AccessibilityIcon: React.FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

/**
 * Settings page component that provides user interface for managing application preferences
 * including theme settings, user preferences, notification settings, and accessibility options
 * with responsive design and WCAG compliance.
 * 
 * Features:
 * - Theme preference management (light/dark mode, system preference)
 * - User preferences (language, timezone)
 * - Notification settings management
 * - Accessibility features (high contrast, reduced motion, large text)
 * - Keyboard navigation and screen reader support
 * - Persistent settings across sessions
 */
const SettingsPage: React.FC = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  
  // Initialize theme preferences
  const initialThemePreference: ThemePreference = {
    theme,
    useSystemPreference: theme.mode === ThemeMode.SYSTEM
  };
  
  // Use the custom hook for settings persistence
  const { settings, updateSettings, syncWithSystemPreference, error } = useSettingsPersistence(initialThemePreference);
  
  // Effect to detect system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (settings.useSystemPreference) {
        setTheme({ 
          mode: ThemeMode.SYSTEM,
          isDark: e.matches 
        });
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.useSystemPreference, setTheme]);

  // Effect for keyboard navigation between settings sections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle keyboard navigation for settings panels using Alt+ArrowDown/ArrowUp
      if (e.key === 'ArrowDown' && e.altKey) {
        const settingsSections = document.querySelectorAll('[data-testid$="-settings"]');
        const focusedElement = document.activeElement;
        
        let currentIndex = -1;
        settingsSections.forEach((section, index) => {
          if (section.contains(focusedElement)) {
            currentIndex = index;
          }
        });
        
        if (currentIndex >= 0 && currentIndex < settingsSections.length - 1) {
          // Focus first focusable element in next section
          const nextSection = settingsSections[currentIndex + 1];
          const focusableElements = nextSection.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          
          if (focusableElements.length > 0) {
            (focusableElements[0] as HTMLElement).focus();
            e.preventDefault();
          }
        }
      } else if (e.key === 'ArrowUp' && e.altKey) {
        const settingsSections = document.querySelectorAll('[data-testid$="-settings"]');
        const focusedElement = document.activeElement;
        
        let currentIndex = -1;
        settingsSections.forEach((section, index) => {
          if (section.contains(focusedElement)) {
            currentIndex = index;
          }
        });
        
        if (currentIndex > 0) {
          // Focus first focusable element in previous section
          const prevSection = settingsSections[currentIndex - 1];
          const focusableElements = prevSection.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          
          if (focusableElements.length > 0) {
            (focusableElements[0] as HTMLElement).focus();
            e.preventDefault();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handler for theme toggle switch
  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    updateSettings({ 
      theme: { 
        ...theme, 
        isDark: !theme.isDark,
        mode: theme.isDark ? ThemeMode.LIGHT : ThemeMode.DARK
      },
      useSystemPreference: false
    });
  }, [theme, toggleTheme, updateSettings]);
  
  // Handler for system preference toggle
  const handleSystemPreferenceToggle = useCallback((checked: boolean) => {
    const newMode = checked ? ThemeMode.SYSTEM : (theme.isDark ? ThemeMode.DARK : ThemeMode.LIGHT);
    
    setTheme({
      mode: newMode,
      isDark: checked 
        ? window.matchMedia('(prefers-color-scheme: dark)').matches 
        : theme.isDark
    });
    
    updateSettings({ 
      useSystemPreference: checked,
      theme: {
        mode: newMode,
        isDark: checked 
          ? window.matchMedia('(prefers-color-scheme: dark)').matches 
          : theme.isDark
      }
    });
    
    // If enabling system preference, sync immediately
    if (checked) {
      syncWithSystemPreference();
    }
  }, [setTheme, theme, syncWithSystemPreference, updateSettings]);
  
  // Notification preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  
  // Accessibility preferences state
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [largeText, setLargeText] = useState(false);
  
  // Apply accessibility classes when they change
  useEffect(() => {
    const html = document.documentElement;
    
    if (highContrast) {
      html.classList.add('high-contrast');
    } else {
      html.classList.remove('high-contrast');
    }
    
    if (reduceMotion) {
      html.classList.add('reduce-motion');
    } else {
      html.classList.remove('reduce-motion');
    }
    
    if (largeText) {
      html.classList.add('large-text');
    } else {
      html.classList.remove('large-text');
    }
  }, [highContrast, reduceMotion, largeText]);
  
  return (
    <ErrorBoundary>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage your account settings and preferences.
            </p>
            
            {/* Display error message if settings persistence fails */}
            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md" role="alert">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}
          </div>
          
          <div className="mt-6">
            {/* Theme Settings */}
            <SettingsSection
              title="Appearance"
              description="Customize how the User Management Dashboard looks for you."
              icon={ThemeIcon}
              testId="theme-settings"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="theme-toggle" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>Dark Mode</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Toggle between light and dark themes
                    </span>
                  </label>
                  <Switch
                    id="theme-toggle"
                    checked={theme.isDark}
                    onChange={handleThemeToggle}
                    className={`${
                      theme.isDark ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Toggle dark mode"
                  >
                    <span className="sr-only">Toggle dark mode</span>
                    <span
                      className={`${
                        theme.isDark ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="system-preference" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>Use System Preference</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Automatically match your device's theme settings
                    </span>
                  </label>
                  <Switch
                    id="system-preference"
                    checked={settings.useSystemPreference}
                    onChange={handleSystemPreferenceToggle}
                    className={`${
                      settings.useSystemPreference ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Use system theme preference"
                  >
                    <span className="sr-only">Use system theme preference</span>
                    <span
                      className={`${
                        settings.useSystemPreference ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
              </div>
            </SettingsSection>
            
            {/* User Preferences */}
            <SettingsSection
              title="User Preferences"
              description="Personalize your user experience."
              icon={UserIcon}
              testId="user-preferences"
            >
              <div className="space-y-4">
                <div>
                  <label 
                    htmlFor="language-select" 
                    className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Language
                  </label>
                  <select
                    id="language-select"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    defaultValue="en"
                    aria-label="Select your preferred language"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
                
                <div>
                  <label 
                    htmlFor="timezone-select" 
                    className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Time Zone
                  </label>
                  <select
                    id="timezone-select"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    defaultValue="UTC"
                    aria-label="Select your time zone"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="EST">EST (Eastern Standard Time)</option>
                    <option value="CST">CST (Central Standard Time)</option>
                    <option value="PST">PST (Pacific Standard Time)</option>
                    <option value="GMT">GMT (Greenwich Mean Time)</option>
                  </select>
                </div>
              </div>
            </SettingsSection>
            
            {/* Notification Settings */}
            <SettingsSection
              title="Notifications"
              description="Choose how you want to be notified."
              icon={NotificationIcon}
              testId="notification-settings"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="email-notifications" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>Email Notifications</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Receive notifications via email
                    </span>
                  </label>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onChange={setEmailNotifications}
                    className={`${
                      emailNotifications ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Enable email notifications"
                  >
                    <span className="sr-only">Enable email notifications</span>
                    <span
                      className={`${
                        emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="push-notifications" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>Push Notifications</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Receive notifications in your browser
                    </span>
                  </label>
                  <Switch
                    id="push-notifications"
                    checked={pushNotifications}
                    onChange={setPushNotifications}
                    className={`${
                      pushNotifications ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Enable push notifications"
                  >
                    <span className="sr-only">Enable push notifications</span>
                    <span
                      className={`${
                        pushNotifications ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
              </div>
            </SettingsSection>
            
            {/* Accessibility Settings */}
            <SettingsSection
              title="Accessibility"
              description="Customize accessibility features to suit your needs."
              icon={AccessibilityIcon}
              testId="accessibility-settings"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="high-contrast" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>High Contrast</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Increase contrast for better readability
                    </span>
                  </label>
                  <Switch
                    id="high-contrast"
                    checked={highContrast}
                    onChange={setHighContrast}
                    className={`${
                      highContrast ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Enable high contrast mode"
                  >
                    <span className="sr-only">Enable high contrast mode</span>
                    <span
                      className={`${
                        highContrast ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="reduce-motion" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>Reduce Motion</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Minimize animations throughout the interface
                    </span>
                  </label>
                  <Switch
                    id="reduce-motion"
                    checked={reduceMotion}
                    onChange={setReduceMotion}
                    className={`${
                      reduceMotion ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Enable reduced motion"
                  >
                    <span className="sr-only">Enable reduced motion</span>
                    <span
                      className={`${
                        reduceMotion ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="large-text" 
                    className="flex flex-col text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span>Large Text</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Increase text size for better readability
                    </span>
                  </label>
                  <Switch
                    id="large-text"
                    checked={largeText}
                    onChange={setLargeText}
                    className={`${
                      largeText ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                    aria-label="Enable large text mode"
                  >
                    <span className="sr-only">Enable large text mode</span>
                    <span
                      className={`${
                        largeText ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default SettingsPage;